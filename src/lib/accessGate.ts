// Whether the API is currently refusing this account's ordinary requests
// because it has no valid trial or subscription.
//
// A leaf module with no imports, for the same reason netStatus is one: both
// src/api/client.ts and the React tree need it, and anything it imported back
// would be a cycle.
//
// This mirrors how a 401 is handled — the API's answer is what flips the app,
// not a timer or a screen guess. The difference is that a 402 must never sign
// anyone out: the session is fine, the subscription is not.

/** HTTP status the API answers when the account may not use normal features. */
export const SUBSCRIPTION_REQUIRED_STATUS = 402

let blocked = false
const subs = new Set<(blocked: boolean) => void>()

export function isAccessBlocked(): boolean {
  return blocked
}

/** Notified whenever the gate opens or closes. Returns an unsubscribe function. */
export function onAccessChange(fn: (blocked: boolean) => void): () => void {
  subs.add(fn)
  return () => subs.delete(fn)
}

function set(next: boolean): void {
  if (blocked === next) return
  blocked = next
  for (const fn of subs) fn(next)
}

/** Called from apiFetch on a 402, so the UI reacts the moment the API says no. */
export function markAccessBlocked(): void {
  set(true)
}

/**
 * Called when the server confirms access is available again — a successful
 * billing sync or status read. Deliberately not called from every 2xx: the
 * open routes (export, account, billing) answer 200 to an expired account, so
 * treating any success as proof of access would unblock the app on the very
 * requests that are meant to stay reachable while expired.
 */
export function markAccessAllowed(): void {
  set(false)
}
