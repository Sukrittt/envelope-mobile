// Per-month category analytics for Insights. Kept separate from envelope.ts
// (the current-envelope math) since this is read-only history over an
// arbitrary past month, not the live assign/spend engine.
import { computeEnvelopeState, CREDIT_CARD_CATEGORY, INCOME_CATEGORY } from './envelope'
import { splitEmoji } from './emoji'
import type { BudgetRow, CategoryRow, ExpenseRow } from '@/src/types'

/** "2026-09" -> { start: "2026-09-01", end: "2026-09-30" }. String-built, no
 *  Date/toISOString round-trip, so it can't roll back a day in a UTC+ zone. */
export function monthRange(key: string): { start: string; end: string } {
  const [y, m] = key.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return { start: `${key}-01`, end: `${key}-${String(lastDay).padStart(2, '0')}` }
}

/** 7-day range starting at `startIso`, built by string date-math (no toISOString). */
export function weekRange(startIso: string): { start: string; end: string } {
  const [y, m, d] = startIso.split('-').map(Number)
  const end = new Date(y, m - 1, d + 6)
  const end_ = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
  return { start: startIso, end: end_ }
}

export interface BreakdownRow {
  key: string
  label: string
  emoji: string
  spent: number
  assigned: number
  pct: number
  deltaPct?: number | null
}

function isExcluded(category: string): boolean {
  return category === CREDIT_CARD_CATEGORY || category === INCOME_CATEGORY
}

/** Per-category or per-group spend for `month`, joined with that month's assigned amounts.
 *  Spend is aggregated directly off `expenses` (not off computeEnvelopeState's envelope
 *  list) so a category deleted since the month it was spent in still shows its spend. */
export function categoryBreakdown(
  budgetRows: BudgetRow[],
  expenseRows: ExpenseRow[],
  categoryRows: CategoryRow[],
  groupNames: string[],
  month: string,
  mode: 'category' | 'group',
): BreakdownRow[] {
  const spentByCategory = new Map<string, number>()
  for (const e of expenseRows) {
    if (!e.date.startsWith(month)) continue
    if (isExcluded(e.category)) continue
    spentByCategory.set(e.category, (spentByCategory.get(e.category) ?? 0) + (Number(e.amount_inr) || 0))
  }

  const envelopeState = computeEnvelopeState(budgetRows, expenseRows, month, categoryRows, groupNames)
  const assignedByCategory = new Map<string, number>()
  for (const env of envelopeState.envelopes) {
    if (isExcluded(env.category)) continue
    assignedByCategory.set(env.category, env.assigned)
  }

  const groupByCategory = new Map<string, string>()
  for (const c of categoryRows) groupByCategory.set(c.name, c.group ?? '')

  const total = [...spentByCategory.values()].reduce((s, v) => s + v, 0) || 1

  if (mode === 'category') {
    const rows: BreakdownRow[] = [...spentByCategory.keys()].map((category) => {
      const { icon, text } = splitEmoji(category)
      const spent = spentByCategory.get(category) ?? 0
      return {
        key: category,
        label: text,
        emoji: icon,
        spent,
        assigned: assignedByCategory.get(category) ?? 0,
        pct: (spent / total) * 100,
      }
    })
    return rows.sort((a, b) => b.spent - a.spent)
  }

  const spentByGroup = new Map<string, number>()
  const assignedByGroup = new Map<string, number>()
  for (const [category, spent] of spentByCategory) {
    const group = groupByCategory.get(category) || 'Other'
    spentByGroup.set(group, (spentByGroup.get(group) ?? 0) + spent)
    assignedByGroup.set(group, (assignedByGroup.get(group) ?? 0) + (assignedByCategory.get(category) ?? 0))
  }
  const rows: BreakdownRow[] = [...spentByGroup.keys()].map((group) => {
    const spent = spentByGroup.get(group) ?? 0
    return {
      key: group,
      label: group,
      emoji: '',
      spent,
      assigned: assignedByGroup.get(group) ?? 0,
      pct: (spent / total) * 100,
    }
  })
  return rows.sort((a, b) => b.spent - a.spent)
}

/** Attaches deltaPct vs the matching row (by key) in `prevRows`. null when the
 *  previous month had no spend in that category — no meaningful percentage
 *  off a zero base. */
export function withDelta(rows: BreakdownRow[], prevRows: BreakdownRow[]): BreakdownRow[] {
  const prevByKey = new Map(prevRows.map((r) => [r.key, r.spent]))
  return rows.map((row) => {
    const prevSpent = prevByKey.get(row.key)
    const deltaPct = prevSpent ? ((row.spent - prevSpent) / prevSpent) * 100 : null
    return { ...row, deltaPct }
  })
}

/** income - totalSpent for an arbitrary month. Generalizes Home's
 *  prevMonthLeftover (app/(tabs)/index.tsx) to any month key. */
export function leftoverFor(
  budgetRows: BudgetRow[],
  expenseRows: ExpenseRow[],
  categoryRows: CategoryRow[],
  groupNames: string[],
  month: string,
): number {
  const state = computeEnvelopeState(budgetRows, expenseRows, month, categoryRows, groupNames)
  return state.income - state.totalSpent
}
