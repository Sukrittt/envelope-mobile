import { monthRange, weekRange, categoryBreakdown, withDelta, leftoverFor } from './monthly'
import { CREDIT_CARD_CATEGORY, INCOME_CATEGORY } from './envelope'
import type { BudgetRow, CategoryRow, ExpenseRow } from '@/src/types'

function budget(month: string, category: string, assigned: string): BudgetRow {
  return { month, category, assigned, rolled_over: '0' }
}

function expense(date: string, category: string, amount_inr: string): ExpenseRow {
  return {
    timestamp: date,
    date,
    item: 'x',
    amount_inr,
    category,
    notes: '',
    source: '',
    amount: amount_inr,
    description: '',
    payment_method: '',
  }
}

describe('monthRange', () => {
  it('does not drop the last day of a 30-day month', () => {
    expect(monthRange('2026-09')).toEqual({ start: '2026-09-01', end: '2026-09-30' })
  })

  it('does not drop the last day of a 31-day month', () => {
    expect(monthRange('2026-08')).toEqual({ start: '2026-08-01', end: '2026-08-31' })
  })

  it('handles February in a leap year', () => {
    expect(monthRange('2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' })
  })

  it('handles February in a non-leap year', () => {
    expect(monthRange('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' })
  })
})

describe('weekRange', () => {
  it('spans 7 days from the given start', () => {
    expect(weekRange('2026-09-01')).toEqual({ start: '2026-09-01', end: '2026-09-07' })
  })

  it('crosses a month boundary correctly', () => {
    expect(weekRange('2026-09-28')).toEqual({ start: '2026-09-28', end: '2026-10-04' })
  })
})

describe('categoryBreakdown', () => {
  const categories: CategoryRow[] = [
    { name: '🍔 Food', group: 'Living' },
    { name: '🏠 Rent', group: 'Living' },
    { name: 'Misc', group: '' },
  ]
  const groups = ['Living']

  it('keeps spend for a category deleted since the month it was spent in', () => {
    const expenses = [expense('2026-08-05', 'Old Category', '500')]
    const rows = categoryBreakdown([], expenses, [], [], '2026-08', 'category')
    expect(rows.find((r) => r.key === 'Old Category')?.spent).toBe(500)
  })

  it('excludes credit card payments and income', () => {
    const expenses = [
      expense('2026-08-05', CREDIT_CARD_CATEGORY, '1000'),
      expense('2026-08-05', INCOME_CATEGORY, '5000'),
      expense('2026-08-05', '🍔 Food', '200'),
    ]
    const rows = categoryBreakdown([], expenses, categories, groups, '2026-08', 'category')
    expect(rows.some((r) => r.key === CREDIT_CARD_CATEGORY)).toBe(false)
    expect(rows.some((r) => r.key === INCOME_CATEGORY)).toBe(false)
    expect(rows.find((r) => r.key === '🍔 Food')?.spent).toBe(200)
  })

  it('splits emoji from the label', () => {
    const expenses = [expense('2026-08-05', '🍔 Food', '200')]
    const rows = categoryBreakdown([], expenses, categories, groups, '2026-08', 'category')
    const row = rows.find((r) => r.label === 'Food')
    expect(row?.emoji).toBe('🍔')
  })

  it('joins assigned amounts from budgets', () => {
    const budgets = [budget('2026-08', '🍔 Food', '1000')]
    const expenses = [expense('2026-08-05', '🍔 Food', '200')]
    const rows = categoryBreakdown(budgets, expenses, categories, groups, '2026-08', 'category')
    expect(rows.find((r) => r.key === '🍔 Food')?.assigned).toBe(1000)
  })

  it('rolls up by group, bucketing ungrouped categories into Other', () => {
    const expenses = [
      expense('2026-08-05', '🍔 Food', '200'),
      expense('2026-08-05', '🏠 Rent', '300'),
      expense('2026-08-05', 'Misc', '50'),
    ]
    const rows = categoryBreakdown([], expenses, categories, groups, '2026-08', 'group')
    expect(rows.find((r) => r.key === 'Living')?.spent).toBe(500)
    expect(rows.find((r) => r.key === 'Other')?.spent).toBe(50)
  })

  it('sorts rows descending by spend', () => {
    const expenses = [
      expense('2026-08-05', '🍔 Food', '100'),
      expense('2026-08-05', '🏠 Rent', '900'),
    ]
    const rows = categoryBreakdown([], expenses, categories, groups, '2026-08', 'category')
    expect(rows[0].key).toBe('🏠 Rent')
  })

  it('only counts expenses within the given month', () => {
    const expenses = [
      expense('2026-07-05', '🍔 Food', '999'),
      expense('2026-08-05', '🍔 Food', '100'),
    ]
    const rows = categoryBreakdown([], expenses, categories, groups, '2026-08', 'category')
    expect(rows.find((r) => r.key === '🍔 Food')?.spent).toBe(100)
  })
})

describe('withDelta', () => {
  it('computes deltaPct against the previous month rows', () => {
    const rows = [{ key: 'Food', label: 'Food', emoji: '', spent: 150, assigned: 0, pct: 0 }]
    const prevRows = [{ key: 'Food', label: 'Food', emoji: '', spent: 100, assigned: 0, pct: 0 }]
    const result = withDelta(rows, prevRows)
    expect(result[0].deltaPct).toBe(50)
  })

  it('returns null delta when the previous month had zero spend', () => {
    const rows = [{ key: 'Food', label: 'Food', emoji: '', spent: 150, assigned: 0, pct: 0 }]
    const prevRows: typeof rows = []
    const result = withDelta(rows, prevRows)
    expect(result[0].deltaPct).toBeNull()
  })
})

describe('leftoverFor', () => {
  it('matches income minus total spend for the given month', () => {
    const budgets = [budget('2026-07', INCOME_CATEGORY, '10000'), budget('2026-07', '🍔 Food', '1000')]
    const expenses = [expense('2026-07-05', '🍔 Food', '600')]
    const categories: CategoryRow[] = [{ name: '🍔 Food', group: 'Living' }]
    const groups = ['Living']
    expect(leftoverFor(budgets, expenses, categories, groups, '2026-07')).toBe(10000 - 600)
  })
})
