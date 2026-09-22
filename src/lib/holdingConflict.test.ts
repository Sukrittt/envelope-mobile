import { holdingChanges, holdingDraft, rebaseHoldingDraft } from './holdingConflict'
import type { HoldingRow } from '@/src/types'

function holding(overrides: Partial<HoldingRow> = {}): HoldingRow {
  return {
    name: 'Stocks',
    type: 'Equity',
    value: '1000',
    updated_at: '',
    is_recurring: 'true',
    recurring_amount: '100',
    recurring_day: '23',
    recurring_last_run: '',
    version: 4,
    ...overrides,
  }
}

describe('holding conflict helpers', () => {
  it('treats recurring state and amount as one logical edit', () => {
    expect(
      holdingChanges(holdingDraft(holding()), { isRecurring: true, recurringAmount: '150' }),
    ).toEqual({ is_recurring: true, recurring_amount: '150' })
  })

  it('keeps the complete user draft when rebasing after a conflict', () => {
    const original = holdingDraft(holding())
    const draft = { isRecurring: true, recurringAmount: '150' }
    const latest = holding({ value: '1200', recurring_amount: '200', version: 5 })

    expect(rebaseHoldingDraft(original, draft, latest)).toEqual(draft)
  })

  it('uses the latest recurring values when the user made no logical edit', () => {
    const original = holdingDraft(holding())
    const latest = holding({ recurring_amount: '200', version: 5 })

    expect(rebaseHoldingDraft(original, original, latest)).toEqual({
      isRecurring: true,
      recurringAmount: '200',
    })
  })
})
