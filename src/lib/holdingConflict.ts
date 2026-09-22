import type { HoldingRow } from '@/src/types'

export class HoldingWriteError extends Error {
  constructor(readonly status: number, message: string, readonly current?: HoldingRow) {
    super(message)
    this.name = 'HoldingWriteError'
  }
}

export type HoldingDraft = { isRecurring: boolean; recurringAmount: string }

export function holdingDraft(row: HoldingRow): HoldingDraft {
  return {
    isRecurring: row.is_recurring === 'true',
    recurringAmount: row.recurring_amount || '',
  }
}

/** Recurrence is one logical field: keep the switch and amount together. */
export function holdingChanges(original: HoldingDraft, draft: HoldingDraft) {
  const changed =
    draft.isRecurring !== original.isRecurring ||
    (draft.isRecurring && Number(draft.recurringAmount) !== Number(original.recurringAmount))

  if (!changed) return {}
  return draft.isRecurring
    ? { is_recurring: true, recurring_amount: draft.recurringAmount.trim() }
    : { is_recurring: false }
}

/** Rebase the complete logical recurrence edit onto the latest holding. */
export function rebaseHoldingDraft(
  original: HoldingDraft,
  draft: HoldingDraft,
  latest: HoldingRow,
): HoldingDraft {
  return Object.keys(holdingChanges(original, draft)).length > 0 ? draft : holdingDraft(latest)
}
