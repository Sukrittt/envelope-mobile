import AsyncStorage from '@react-native-async-storage/async-storage'
import { currentUserId } from '@/src/api/accessMode'
import type { ExpensePayload } from '@/src/api/expenses'

const PREFIX = 'mc-pending-expenses'
const FAILED_PREFIX = 'mc-failed-expenses'

export type PendingExpense = { payload: ExpensePayload; attempts: number }

function key(): string | null {
  const uid = currentUserId()
  return uid ? `${PREFIX}:${uid}` : null
}

function failedKey(): string | null {
  const uid = currentUserId()
  return uid ? `${FAILED_PREFIX}:${uid}` : null
}

async function read(k: string): Promise<PendingExpense[]> {
  const raw = await AsyncStorage.getItem(k)
  if (!raw) return []
  try {
    return JSON.parse(raw) as PendingExpense[]
  } catch {
    return []
  }
}

async function write(k: string, entries: PendingExpense[]): Promise<void> {
  await AsyncStorage.setItem(k, JSON.stringify(entries))
}

// Every mutation is serialized through one promise chain — an enqueue racing
// a concurrent drain over AsyncStorage's read-modify-write is a real bug
// otherwise (the loser's write clobbers the winner's). Same single-flight
// idiom as accessMode.ts's `refreshing`.
let chain: Promise<unknown> = Promise.resolve()
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const result = chain.then(fn, fn)
  chain = result.catch(() => {})
  return result
}

/** Queues a create for later sync. No-op when signed out as guest (nothing to namespace it by). */
export function enqueue(payload: ExpensePayload): Promise<void> {
  return serialize(async () => {
    const k = key()
    if (!k) return
    const entries = await read(k)
    entries.push({ payload, attempts: 0 })
    await write(k, entries)
  })
}

/** All queued expenses, oldest first. */
export function list(): Promise<PendingExpense[]> {
  return serialize(async () => {
    const k = key()
    return k ? read(k) : []
  })
}

export function count(): Promise<number> {
  return list().then((entries) => entries.length)
}

/** Removes one entry by its client_id — a successful sync, or a manual Undo. */
export function remove(clientId: string): Promise<void> {
  return serialize(async () => {
    const k = key()
    if (!k) return
    const entries = await read(k)
    await write(
      k,
      entries.filter((e) => e.payload.client_id !== clientId),
    )
  })
}

/** Bumps an entry's attempt count; moves it to the failed list once it hits the cap. */
export function bumpAttempts(clientId: string, cap: number): Promise<void> {
  return serialize(async () => {
    const k = key()
    if (!k) return
    const entries = await read(k)
    const entry = entries.find((e) => e.payload.client_id === clientId)
    if (!entry) return
    entry.attempts += 1
    if (entry.attempts >= cap) {
      await write(
        k,
        entries.filter((e) => e.payload.client_id !== clientId),
      )
      const fk = failedKey()
      if (fk) await write(fk, [...(await read(fk)), entry])
    } else {
      await write(k, entries)
    }
  })
}

export function listFailed(): Promise<PendingExpense[]> {
  return serialize(async () => {
    const fk = failedKey()
    return fk ? read(fk) : []
  })
}
