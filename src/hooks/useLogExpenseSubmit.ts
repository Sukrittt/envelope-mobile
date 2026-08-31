import { useSyncExternalStore } from 'react'

// Bridges log-expense.tsx's local submit state to TabBar, which renders the
// nav circle that now triggers the submit. The two are siblings (TabBar is
// mounted once above the root Stack), so there's no prop/ref path between
// them — a tiny external store fills the gap without a context provider.
export type LogExpenseSubmitSnapshot = {
  canSubmit: boolean
  saving: boolean
  success: boolean
  submit: () => void
}

const DEFAULT: LogExpenseSubmitSnapshot = { canSubmit: false, saving: false, success: false, submit: () => {} }

let snapshot = DEFAULT
const listeners = new Set<() => void>()

export function publishLogExpenseSubmit(next: LogExpenseSubmitSnapshot): void {
  snapshot = next
  listeners.forEach((l) => l())
}

export function resetLogExpenseSubmit(): void {
  snapshot = DEFAULT
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): LogExpenseSubmitSnapshot {
  return snapshot
}

export function useLogExpenseSubmitState(): LogExpenseSubmitSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
