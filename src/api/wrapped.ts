import { apiFetch } from './client'

export interface WrappedData {
  range: { startDate: string; endDate: string; daysTracked: number }
  totalSpent: number
  totalTransactions: number
  topCategories: Array<{ category: string; total: number; pct: number }>
  biggestPurchase: { item: string; amountInr: number; category: string; date: string } | null
  topWeekday: { day: string; total: number; count: number } | null
  longestStreak: { days: number; startDate: string; endDate: string } | null
  longestGap: { days: number; startDate: string; endDate: string } | null
}

export async function getWrapped(): Promise<WrappedData> {
  const resp = await apiFetch('/api/wrapped')
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}))
    throw new Error(detail.error ?? `Failed to load wrapped: ${resp.status}`)
  }
  return resp.json()
}
