import { AppState } from 'react-native'
import { getValidToken, currentUserId, sessionGeneration } from '@/src/api/accessMode'
import { HttpError } from '@/src/api/client'
import { postExpensePayload } from '@/src/api/expenses'
import * as pending from '@/src/lib/pendingExpenses'
import { onOnlineTransition } from '@/src/lib/netStatus'
import { SUBSCRIPTION_REQUIRED_STATUS } from '@/src/lib/accessGate'

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
    inFlight = drain().catch(() => { /* Retain queues on storage/auth failures; retry later. */ }).finally(() => {
      inFlight = null
    })
  }
  return inFlight
}

async function drain(): Promise<void> {
  // No valid token → don't flush. A request with no Authorization header is
  // answered as the read-only demo user, which would silently "succeed"
  // against the wrong account. Leave the queue intact; the next trigger retries.
  const owner = currentUserId()
  const generation = sessionGeneration()
  if (!owner) return
  const token = await getValidToken()
  if (!token || generation !== sessionGeneration()) return

  const entries = await pending.list(owner)
  for (const entry of entries) {
    if (generation !== sessionGeneration()) return
    try {
      await postExpensePayload(entry.payload, generation)
      if (generation !== sessionGeneration()) return
      await pending.remove(entry.payload.client_id, owner)
    } catch (err) {
      if (generation !== sessionGeneration()) return
      if (err instanceof HttpError) {
        // The subscription gate, not a bad entry. Stop the whole drain and
        // leave the queue untouched: every remaining entry would hit the same
        // gate, and bumping attempts here would dead-letter everything the
        // user logged offline about ninety seconds after their trial quietly
        // expired. They renew, and the expenses are gone. The queue waits
        // instead, and drains when access comes back.
        if ([401, 403, 408, 429, SUBSCRIPTION_REQUIRED_STATUS].includes(err.status) || err.status >= 500) return
        // This entry will never succeed as-is — bump it and move on to the
        // rest of the queue rather than blocking everything behind it.
        await pending.bumpAttempts(entry.payload.client_id, MAX_ATTEMPTS, owner)
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
    }).catch(() => {})
  }, 30_000)

  return () => {
    appStateSub.remove()
    unsubscribeOnline()
    clearInterval(interval)
  }
}
