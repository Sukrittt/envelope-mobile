// Tells AuthGate the setup wizard just finished, so it can flip its local
// `onboarded` state immediately instead of waiting for a re-fetch that never
// happens (the guard effect only re-runs on hasSession changes, not on navigation).
const subs = new Set<() => void>()

export function onOnboarded(fn: () => void): () => void {
  subs.add(fn)
  return () => subs.delete(fn)
}

export function signalOnboarded(): void {
  for (const fn of subs) fn()
}
