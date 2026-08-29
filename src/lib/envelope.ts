// Ported from Web/src/services/budgetLoader.ts::computeEnvelopes — same math,
// adapted to Mobile's row types (BudgetRow/ExpenseRow have string number fields).
// Do not change the formulas without checking the web version stays in sync.
import type { BudgetRow, CategoryRow, ExpenseRow } from '@/src/types'

export interface Envelope {
  category: string
  group: string
  assigned: number
  spent: number
  available: number
  rolledOver: number
  isOverspent: boolean
  spentPct: number
  isCreditCardPayment: boolean
  lastSpentDate?: string
}

export interface EnvelopeState {
  month: string
  income: number
  totalAssigned: number
  totalSpent: number
  readyToAssign: number
  isOverAssigned: boolean
  envelopes: Envelope[]
  groups: string[]
}

interface BudgetNum {
  month: string
  category: string
  assigned: number
  rolledOver: number
}
interface ExpenseNum {
  date: string
  amountInr: number
  category: string
}

export const CREDIT_CARD_CATEGORY = '__credit_card__'
export const INCOME_CATEGORY = '__income__'

export function currentMonthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function prevMonthKey(key: string): string {
  return shiftMonthKey(key, -1)
}

/** Month key `delta` months away from `key`. Negative goes back. */
export function shiftMonthKey(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** "2026-08" -> "August 2026". */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

export function daysLeftInMonth(): number {
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return daysInMonth - now.getDate()
}

function monthSpendingByCategory(expenses: ExpenseNum[], month: string): Map<string, number> {
  const map = new Map<string, number>()
  for (const e of expenses) {
    if (!e.date.startsWith(month)) continue
    map.set(e.category, (map.get(e.category) ?? 0) + e.amountInr)
  }
  return map
}

function lastSpentByCategory(expenses: ExpenseNum[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const e of expenses) {
    if (!e.date) continue
    const current = map.get(e.category)
    if (!current || e.date > current) map.set(e.category, e.date)
  }
  return map
}

export function computeEnvelopeState(
  budgetRows: BudgetRow[],
  expenseRows: ExpenseRow[],
  currentMonth: string,
  categoryRows: CategoryRow[],
  groupNames: string[],
): EnvelopeState {
  const budgets: BudgetNum[] = budgetRows.map((b) => ({
    month: b.month,
    category: b.category,
    assigned: Number(b.assigned) || 0,
    rolledOver: Number(b.rolled_over) || 0,
  }))
  const expenses: ExpenseNum[] = expenseRows.map((e) => ({
    date: e.date,
    amountInr: Number(e.amount_inr) || 0,
    category: e.category,
  }))

  const monthBudgets = budgets.filter((b) => b.month === currentMonth)
  const prevMonthBudgets = budgets.filter((b) => b.month < currentMonth)

  const prevMonthMap = new Map<string, BudgetNum[]>()
  for (const b of prevMonthBudgets) {
    const arr = prevMonthMap.get(b.category) ?? []
    arr.push(b)
    prevMonthMap.set(b.category, arr)
  }

  const incomeRow = monthBudgets.find((b) => b.category === INCOME_CATEGORY)
  const income = incomeRow?.assigned ?? 0

  const monthSpending = monthSpendingByCategory(expenses, currentMonth)
  const lastSpentByCat = lastSpentByCategory(expenses)

  const categoryGroup = new Map<string, string>()
  for (const c of categoryRows) categoryGroup.set(c.name, c.group ?? '')

  const budgetCategories = new Set(
    [...monthBudgets, ...prevMonthBudgets]
      .filter((b) => b.category !== INCOME_CATEGORY)
      .map((b) => b.category),
  )

  const allCategories = [...new Set([...categoryRows.map((c) => c.name), ...budgetCategories])]

  const envelopes: Envelope[] = []
  let totalAssigned = 0
  let totalSpent = 0

  for (const category of allCategories) {
    const curr = monthBudgets.find((b) => b.category === category)
    const prevMonths = prevMonthMap.get(category) ?? []
    const prevSorted = [...prevMonths].sort((a, b) => b.month.localeCompare(a.month))
    const prev = prevSorted[0]

    let prevSpent = 0
    if (prev) {
      prevSpent = expenses
        .filter((e) => e.date.startsWith(prev.month) && e.category === category)
        .reduce((s, e) => s + e.amountInr, 0)
    }

    const isCC = category === CREDIT_CARD_CATEGORY
    const assigned = curr?.assigned ?? 0
    const rolledOver = curr?.rolledOver ?? 0
    const computedRollover = prev ? Math.max(0, prev.assigned + prev.rolledOver - prevSpent) : rolledOver

    const spent = monthSpending.get(category) ?? 0
    const available = assigned + computedRollover - spent

    if (!isCC) {
      totalAssigned += assigned
      totalSpent += spent
    }

    envelopes.push({
      category,
      group: isCC ? '' : (categoryGroup.get(category) ?? ''),
      assigned,
      spent,
      available,
      rolledOver: computedRollover,
      isOverspent: available < 0,
      spentPct: assigned > 0 ? Math.min(100, (spent / assigned) * 100) : spent > 0 ? 100 : 0,
      isCreditCardPayment: isCC,
      lastSpentDate: lastSpentByCat.get(category),
    })
  }

  const readyToAssign = Math.round(income - totalAssigned) || 0

  return {
    month: currentMonth,
    income,
    totalAssigned,
    totalSpent,
    readyToAssign,
    envelopes,
    isOverAssigned: readyToAssign < 0,
    groups: groupNames.filter((g) => envelopes.some((e) => e.group === g)),
  }
}
