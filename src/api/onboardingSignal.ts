// Tells the root layout the setup wizard just finished, so it can flip its
// local `onboarded` state — and with it the Stack.Protected guards — immediately
// instead of waiting for a re-fetch that only runs when hasSession changes.
const subs = new Set<() => void>()

export function onOnboarded(fn: () => void): () => void {
  subs.add(fn)
  return () => subs.delete(fn)
}

export function signalOnboarded(): void {
  for (const fn of subs) fn()
}
