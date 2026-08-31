import { selectRows, selectChips, selectToday, toWidgetData, headerRightLabel, weeklyTrend, layoutFor } from './data'
import { variants } from './variants'
import { lightTokens, darkTokens } from '@/src/theme/tokens'
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

  it('carries the emoji separately as icon', () => {
    const state = stateWithSpends({ '🍔 Food': 100 })
    const food = selectRows(state).find((r) => r.name === 'Food')!
    expect(food.icon).toBe('🍔')
  })

  it('flags an overspent envelope', () => {
    const state = stateWithSpends({ '🍔 Food': 1500 })
    const food = selectRows(state).find((r) => r.name === 'Food')!
    expect(food.overspent).toBe(true)
  })

  it('does not flag an envelope that is within budget', () => {
    const state = stateWithSpends({ '🍔 Food': 100 })
    const food = selectRows(state).find((r) => r.name === 'Food')!
    expect(food.overspent).toBe(false)
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

  it('labels with the full category name in sentence case, no emoji', () => {
    const multiWord: CategoryRow[] = [...categories, { name: '🍽️ Eating out', group: 'Living' }]
    const budgets = [
      ...categories.map((c) => budget('2026-08', c.name, c.name === 'Unbudgeted' ? '0' : '1000')),
      budget('2026-08', '🍽️ Eating out', '1000'),
    ]
    const expenses = [expense('2026-08-05T10:00:00.000Z', '2026-08-05', '🍽️ Eating out', '100')]
    const state = computeEnvelopeState(budgets, expenses, '2026-08', multiWord, ['Living'])
    const chip = selectChips(state).find((c) => c.category === '🍽️ Eating out')!
    expect(chip.label).toBe('Eating out')
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
    expect(headerRightLabel(11, now - 1000, now)).toBe('11 days left')
  })

  it('uses the singular for exactly one day left', () => {
    expect(headerRightLabel(1, now - 1000, now)).toBe('1 day left')
  })

  it('shows less than 24 hours when zero days left', () => {
    expect(headerRightLabel(0, now - 1000, now)).toBe('Less than 24 hrs')
  })

  it('switches to a staleness label once the snapshot is over a day old', () => {
    const twoDaysAgo = now - 2 * 86_400_000
    expect(headerRightLabel(11, twoDaysAgo, now)).toBe('Updated 2 days ago')
  })

  it('uses the singular for exactly one stale day', () => {
    const oneDayAgo = now - 1 * 86_400_000 - 1000
    expect(headerRightLabel(11, oneDayAgo, now)).toBe('Updated 1 day ago')
  })
})

describe('layoutFor', () => {
  it('shows the full layout at the tall end of the resizable range', () => {
    expect(layoutFor(250, 320)).toEqual({ rows: 5, today: 3, buttons: 3, actionHeight: 48 })
  })

  it('drops a row and a today line in the upper-middle band', () => {
    expect(layoutFor(250, 270)).toEqual({ rows: 4, today: 2, buttons: 3, actionHeight: 48 })
  })

  it('drops today entirely and shrinks the action row in the lower-middle band', () => {
    expect(layoutFor(250, 220)).toEqual({ rows: 3, today: 0, buttons: 3, actionHeight: 40 })
  })

  it('drops to 2 rows when short', () => {
    expect(layoutFor(250, 180)).toEqual({ rows: 2, today: 0, buttons: 3, actionHeight: 40 })
  })

  it('shows only the hero and buttons when very short', () => {
    expect(layoutFor(250, 120)).toEqual({ rows: 0, today: 0, buttons: 3, actionHeight: 40 })
  })

  it('drops to 2 buttons when narrow', () => {
    expect(layoutFor(150, 320).buttons).toBe(2)
  })
})

describe('variants', () => {
  it('forces both keys to light tokens for an explicit light preference', () => {
    const result = variants('light', (tokens, scheme) => ({ tokens, scheme }))
    expect(result.light).toEqual({ tokens: lightTokens, scheme: 'light' })
    expect(result.dark).toEqual({ tokens: lightTokens, scheme: 'light' })
  })

  it('forces both keys to dark tokens for an explicit dark preference', () => {
    const result = variants('dark', (tokens, scheme) => ({ tokens, scheme }))
    expect(result.light).toEqual({ tokens: darkTokens, scheme: 'dark' })
    expect(result.dark).toEqual({ tokens: darkTokens, scheme: 'dark' })
  })

  it('lets each key differ for the system preference', () => {
    const result = variants('system', (tokens, scheme) => ({ tokens, scheme }))
    expect(result.light).toEqual({ tokens: lightTokens, scheme: 'light' })
    expect(result.dark).toEqual({ tokens: darkTokens, scheme: 'dark' })
  })
})

describe('weeklyTrend', () => {
  const today = '2026-08-12'
  const d = (date: string, amount: string) => expense('2026-08-05T10:00:00.000Z', date, '🍔 Food', amount)

  it('returns null when there is no spending in either window', () => {
    expect(weeklyTrend([], today)).toBeNull()
    expect(weeklyTrend([d('2026-08-20', '100')], today)).toBeNull()
  })

  it('computes a down trend once this week spent less than last', () => {
    // last week: 12th-18th? no — week offset is trailing 7 days before today.
    // This week: 06..12; last week: -1..05 (relative to 12th).
    const expenses = [d('2026-08-10', '200'), d('2026-08-11', '300'), d('2026-08-04', '1000')]
    expect(weeklyTrend(expenses, today)).toEqual({ pct: -50, dir: 'down' })
  })

  it('computes an up trend once this week spent more than last', () => {
    const expenses = [d('2026-08-10', '1000'), d('2026-08-04', '400')]
    expect(weeklyTrend(expenses, today)).toEqual({ pct: 150, dir: 'up' })
  })

  it('is flat when the two windows match', () => {
    const expenses = [d('2026-08-10', '500'), d('2026-08-04', '500')]
    expect(weeklyTrend(expenses, today)).toEqual({ pct: 0, dir: 'flat' })
  })

  it('reads 100% up when there is no prior-week baseline', () => {
    const expenses = [d('2026-08-10', '500')]
    expect(weeklyTrend(expenses, today)).toEqual({ pct: 100, dir: 'up' })
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
