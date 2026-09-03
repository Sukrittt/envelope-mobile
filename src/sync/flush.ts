import { AppState } from 'react-native'
import { getValidToken } from '@/src/api/accessMode'
import { HttpError } from '@/src/api/client'
import { postExpensePayload } from '@/src/api/expenses'
import * as pending from '@/src/lib/pendingExpenses'
import { onOnlineTransition } from '@/src/lib/netStatus'

/** An entry that has failed this many times will never succeed on its own — move it aside and stop retrying it. */
const MAX_ATTEMPTS = 3

let inFlight: Promise<void> | null = null

/**
 * Drains the pending-expense queue one entry at a time, oldest first, through
 * the same POST /api/expenses every online create uses — no batch endpoint,
 * see the offline-sync plan. Single-flight: a second call while one is
 * already draining just waits on the same run rather than starting a race.
 */
export function flush(): Promise<void> {
  if (!inFlight) {
    inFlight = drain().finally(() => {
      inFlight = null
    })
  }
  return inFlight
}

async function drain(): Promise<void> {
  // No valid token → don't flush. A request with no Authorization header is
  // answered as the read-only demo user, which would silently "succeed"
  // against the wrong account. Leave the queue intact; the next trigger retries.
  const token = await getValidToken()
  if (!token) return

  const entries = await pending.list()
  for (const entry of entries) {
    try {
      await postExpensePayload(entry.payload)
      await pending.remove(entry.payload.client_id)
    } catch (err) {
      if (err instanceof HttpError) {
        // This entry will never succeed as-is — bump it and move on to the
        // rest of the queue rather than blocking everything behind it.
        await pending.bumpAttempts(entry.payload.client_id, MAX_ATTEMPTS)
        continue
      }
      // Transport failure — stop here and leave the remaining entries queued
      // for the next trigger, rather than treating every one of them as failed.
      return
    }
  }
}

/**
 * Wires flush() to fire on the moments it's actually worth trying: coming
 * back to the foreground, the network visibly returning (a free "we're back"
 * signal apiFetch already produces), and a 30s poll as a fallback while
 * anything is still queued. Call once, at app boot.
 */
export function startAutoFlush(): () => void {
  const appStateSub = AppState.addEventListener('change', (state) => {
    if (state === 'active') void flush()
  })
  const unsubscribeOnline = onOnlineTransition(() => void flush())
  const interval = setInterval(() => {
    pending.count().then((n) => {
      if (n > 0) void flush()
    })
  }, 30_000)

  return () => {
    appStateSub.remove()
    unsubscribeOnline()
    clearInterval(interval)
  }
}
