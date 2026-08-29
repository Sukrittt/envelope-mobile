import { selectRows, selectChips, selectToday, toWidgetData, headerRightLabel, layoutFor } from './data'
import { computeEnvelopeState, CREDIT_CARD_CATEGORY } from '@/src/lib/envelope'
import type { BudgetRow, CategoryRow, ExpenseRow } from '@/src/types'

function budget(month: string, category: string, assigned: string): BudgetRow {
  return { month, category, assigned, rolled_over: '0' }
}

function expense(timestamp: string, date: string, category: string, amount_inr: string, item = 'x'): ExpenseRow {
  return {
    timestamp,
    date,
    item,
    amount_inr,
    category,
    notes: '',
    source: '',
    amount: amount_inr,
    description: '',
    payment_method: '',
  }
}

const categories: CategoryRow[] = [
  { name: '🍔 Food', group: 'Living' },
  { name: '🚗 Transport', group: 'Living' },
  { name: '🛒 Groceries', group: 'Living' },
  { name: '🎉 Fun', group: 'Living' },
  { name: 'Unbudgeted', group: 'Living' },
]

function stateWithSpends(spends: Record<string, number>) {
  const budgets = categories.map((c) => budget('2026-08', c.name, c.name === 'Unbudgeted' ? '0' : '1000'))
  budgets.push(budget('2026-08', CREDIT_CARD_CATEGORY, '2000'))
  const expenses: ExpenseRow[] = Object.entries(spends).map(([category, amount]) =>
    expense('2026-08-05T10:00:00.000Z', '2026-08-05', category, String(amount)),
  )
  expenses.push(expense('2026-08-05T10:00:00.000Z', '2026-08-05', CREDIT_CARD_CATEGORY, '500'))
  return computeEnvelopeState(budgets, expenses, '2026-08', categories, ['Living'])
}

describe('selectRows', () => {
  it('excludes the credit-card envelope and zero-assigned envelopes', () => {
    const state = stateWithSpends({ '🍔 Food': 100, Unbudgeted: 50 })
    const rows = selectRows(state)
    expect(rows.some((r) => r.name === 'Unbudgeted')).toBe(false)
    expect(rows.length).toBeLessThanOrEqual(5)
  })

  it('orders by spentPct descending and caps at 5', () => {
    const state = stateWithSpends({
      '🍔 Food': 900, // 90%
      '🚗 Transport': 200, // 20%
      '🛒 Groceries': 500, // 50%
      '🎉 Fun': 100, // 10%
    })
    const rows = selectRows(state)
    expect(rows).toHaveLength(4)
    expect(rows.map((r) => r.name)).toEqual(['Food', 'Groceries', 'Transport', 'Fun'])
  })

  it('peels the leading emoji off the category name', () => {
    const state = stateWithSpends({ '🍔 Food': 100 })
    const food = selectRows(state).find((r) => r.name === 'Food')!
    expect(food.available).toBe('₹900')
  })

  it('rounds available to whole rupees', () => {
    const state = stateWithSpends({ '🍔 Food': 100.5 })
    const food = selectRows(state).find((r) => r.name === 'Food')!
    expect(food.available).not.toContain('.')
  })
})

describe('selectChips', () => {
  it('orders by spend descending and caps at 3', () => {
    const state = stateWithSpends({
      '🍔 Food': 400,
      '🚗 Transport': 800,
      '🛒 Groceries': 200,
      '🎉 Fun': 600,
    })
    const chips = selectChips(state)
    expect(chips).toHaveLength(3)
    expect(chips.map((c) => c.category)).toEqual(['🚗 Transport', '🎉 Fun', '🍔 Food'])
  })

  it('encodes the category into a mobile:// deep link', () => {
    const state = stateWithSpends({ '🍔 Food': 100 })
    const chip = selectChips(state).find((c) => c.category === '🍔 Food')!
    expect(chip.uri).toBe(`mobile://modals/log-expense?category=${encodeURIComponent('🍔 Food')}`)
  })

  it('labels with the full uppercased category name, no emoji', () => {
    const multiWord: CategoryRow[] = [...categories, { name: '🍽️ Eating out', group: 'Living' }]
    const budgets = [
      ...categories.map((c) => budget('2026-08', c.name, c.name === 'Unbudgeted' ? '0' : '1000')),
      budget('2026-08', '🍽️ Eating out', '1000'),
    ]
    const expenses = [expense('2026-08-05T10:00:00.000Z', '2026-08-05', '🍽️ Eating out', '100')]
    const state = computeEnvelopeState(budgets, expenses, '2026-08', multiWord, ['Living'])
    const chip = selectChips(state).find((c) => c.category === '🍽️ Eating out')!
    expect(chip.label).toBe('EATING OUT')
  })
})

describe('selectToday', () => {
  const expenses: ExpenseRow[] = [
    expense('2026-08-05T09:00:00.000Z', '2026-08-05', '🍔 Food', '420', 'Blue Tokai'),
    expense('2026-08-05T11:00:00.000Z', '2026-08-05', '🛒 Groceries', '754', 'Zepto'),
    expense('2026-08-04T10:00:00.000Z', '2026-08-04', '🍔 Food', '999', 'Yesterday'),
  ]

  it('keeps only today, most recent first, capped at 2', () => {
    const today = selectToday(expenses, '2026-08-05')
    expect(today).toEqual([
      { item: 'Zepto', amount: '₹754' },
      { item: 'Blue Tokai', amount: '₹420' },
    ])
  })

  it('is empty when nothing was logged today', () => {
    expect(selectToday(expenses, '2026-08-06')).toEqual([])
  })
})

describe('headerRightLabel', () => {
  const now = Date.parse('2026-08-20T12:00:00Z')

  it('shows days left while the snapshot is under a day old', () => {
    expect(headerRightLabel(11, now - 1000, now)).toBe('LEFT · 11D')
  })

  it('switches to a staleness label once the snapshot is over a day old', () => {
    const twoDaysAgo = now - 2 * 86_400_000
    expect(headerRightLabel(11, twoDaysAgo, now)).toBe('UPDATED 2D AGO')
  })
})

describe('layoutFor', () => {
  it('shows the full layout at the default 4x4 size', () => {
    expect(layoutFor(250, 250)).toEqual({ rows: 5, today: 3, buttons: 3 })
  })

  it('drops a row and a today line in the middle band', () => {
    expect(layoutFor(250, 220)).toEqual({ rows: 3, today: 1, buttons: 3 })
  })

  it('drops today entirely when short', () => {
    expect(layoutFor(250, 180)).toEqual({ rows: 2, today: 0, buttons: 3 })
  })

  it('shows only the hero and buttons when very short', () => {
    expect(layoutFor(250, 120)).toEqual({ rows: 0, today: 0, buttons: 3 })
  })

  it('drops to 2 buttons when narrow', () => {
    expect(layoutFor(150, 250).buttons).toBe(2)
  })
})

describe('toWidgetData', () => {
  it('sums available across non-credit-card envelopes into totalLeft', () => {
    const state = stateWithSpends({ '🍔 Food': 100 })
    const data = toWidgetData(state, [], 11, '2026-08-05')
    // Food/Transport/Groceries/Fun at 1000 assigned (Food spent 100 -> 900 left,
    // the rest untouched at 1000), Unbudgeted at 0 assigned/0 spent -> 0 left.
    // 900 + 1000 + 1000 + 1000 + 0 = 3900
    expect(data.totalLeft).toBe('₹3,900')
    expect(data.daysLeft).toBe(11)
  })
})
