import { apiFetch } from './client'
import type { CsvResponse, ExpenseRow } from '@/src/types'

export async function getExpenses(): Promise<ExpenseRow[]> {
  const resp = await apiFetch('/api/expenses')
  if (!resp.ok) throw new Error(`Failed to load expenses: ${resp.status}`)
  const data: CsvResponse<ExpenseRow> = await resp.json()
  return data.rows
}

export async function addExpense(row: {
  item: string
  amount_inr: string
  category: string
  date?: string
  notes?: string
  payment_method?: string
}): Promise<void> {
  const resp = await apiFetch('/api/expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(row),
  })
  if (!resp.ok) throw new Error(`Failed to add expense: ${resp.status}`)
}

export async function updateExpense(
  timestamp: string,
  item: string,
  amountInr: number,
  updates: {
    new_item?: string
    new_amount_inr?: string
    new_date?: string
    category?: string
  },
): Promise<void> {
  const resp = await apiFetch('/api/expenses', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timestamp, item, amount_inr: String(amountInr), ...updates }),
  })
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}))
    throw new Error(detail.error ?? `Failed to update expense: ${resp.status}`)
  }
}

export async function updateExpenseCategory(
  timestamp: string,
  item: string,
  amountInr: number,
  category: string,
): Promise<void> {
  await updateExpense(timestamp, item, amountInr, { category })
}

export async function deleteExpense(
  timestamp: string,
  item: string,
  amountInr: number,
): Promise<void> {
  const resp = await apiFetch('/api/expenses', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timestamp, item, amount_inr: String(amountInr) }),
  })
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}))
    throw new Error(detail.error ?? `Failed to delete expense: ${resp.status}`)
  }
}
