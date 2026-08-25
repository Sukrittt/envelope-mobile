import { computeEnvelopeState, currentMonthKey, prevMonthKey, CREDIT_CARD_CATEGORY } from './envelope'
import type { BudgetRow, CategoryRow, ExpenseRow } from '@/src/types'

function budget(month: string, category: string, assigned: string, rolled_over = '0'): BudgetRow {
  return { month, category, assigned, rolled_over }
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

describe('currentMonthKey / prevMonthKey', () => {
  it('formats a date as YYYY-MM', () => {
    expect(currentMonthKey(new Date(2026, 7, 25))).toBe('2026-08')
  })

  it('rolls back across a year boundary', () => {
    expect(prevMonthKey('2026-01')).toBe('2025-12')
  })

  it('rolls back within the same year', () => {
    expect(prevMonthKey('2026-08')).toBe('2026-07')
  })
})

describe('computeEnvelopeState', () => {
  const categories: CategoryRow[] = [{ name: 'Rent', group: 'Home' }]

  it('carries forward unspent rollover, floored at 0', () => {
    const budgets = [budget('2026-07', 'Rent', '1000'), budget('2026-08', 'Rent', '1000')]
    const expenses = [expense('2026-07-05', 'Rent', '400')]
    const state = computeEnvelopeState(budgets, expenses, '2026-08', categories, ['Home'])
    const rent = state.envelopes.find((e) => e.category === 'Rent')!
    // prev assigned(1000) + prev rolledOver(0) - prevSpent(400) = 600
    expect(rent.rolledOver).toBe(600)
    expect(rent.available).toBe(1000 + 600 - 0)
  })

  it('floors rollover at 0 when the previous month overspent', () => {
    const budgets = [budget('2026-07', 'Rent', '1000'), budget('2026-08', 'Rent', '1000')]
    const expenses = [expense('2026-07-05', 'Rent', '1500')]
    const state = computeEnvelopeState(budgets, expenses, '2026-08', categories, ['Home'])
    const rent = state.envelopes.find((e) => e.category === 'Rent')!
    expect(rent.rolledOver).toBe(0)
  })

  it('computes readyToAssign and isOverAssigned', () => {
    const budgets = [
      budget('2026-08', '__income__', '5000'),
      budget('2026-08', 'Rent', '4000'),
    ]
    const state = computeEnvelopeState(budgets, [], '2026-08', categories, ['Home'])
    expect(state.readyToAssign).toBe(1000)
    expect(state.isOverAssigned).toBe(false)

    const overBudgets = [
      budget('2026-08', '__income__', '3000'),
      budget('2026-08', 'Rent', '4000'),
    ]
    const overState = computeEnvelopeState(overBudgets, [], '2026-08', categories, ['Home'])
    expect(overState.readyToAssign).toBe(-1000)
    expect(overState.isOverAssigned).toBe(true)
  })

  it('excludes the credit-card category from totals', () => {
    const budgets = [budget('2026-08', CREDIT_CARD_CATEGORY, '2000'), budget('2026-08', 'Rent', '1000')]
    const expenses = [expense('2026-08-01', CREDIT_CARD_CATEGORY, '500')]
    const state = computeEnvelopeState(budgets, expenses, '2026-08', categories, ['Home'])
    expect(state.totalAssigned).toBe(1000)
    expect(state.totalSpent).toBe(0)
    const cc = state.envelopes.find((e) => e.category === CREDIT_CARD_CATEGORY)!
    expect(cc.isCreditCardPayment).toBe(true)
    expect(cc.group).toBe('')
  })

  it('clamps spentPct to 100 and only shows 100 with no assignment when something was spent', () => {
    const budgets = [budget('2026-08', 'Rent', '100')]
    const expenses = [expense('2026-08-01', 'Rent', '250')]
    const state = computeEnvelopeState(budgets, expenses, '2026-08', categories, ['Home'])
    const rent = state.envelopes.find((e) => e.category === 'Rent')!
    expect(rent.spentPct).toBe(100)
    expect(rent.isOverspent).toBe(true)

    const noAssign = computeEnvelopeState(
      [],
      [expense('2026-08-01', 'Rent', '50')],
      '2026-08',
      categories,
      ['Home'],
    )
    const rentNoAssign = noAssign.envelopes.find((e) => e.category === 'Rent')!
    expect(rentNoAssign.spentPct).toBe(100)

    const noSpend = computeEnvelopeState([], [], '2026-08', categories, ['Home'])
    const rentNoSpend = noSpend.envelopes.find((e) => e.category === 'Rent')
    expect(rentNoSpend?.spentPct).toBe(0)
  })

  it('only keeps groups that have at least one envelope', () => {
    const state = computeEnvelopeState([], [], '2026-08', categories, ['Home', 'Empty Group'])
    expect(state.groups).toEqual(['Home'])
  })
})
