// Row shapes ported verbatim from Web/src/services/api.ts — the deployed API
// returns these exact field names, so no reshaping happens on the mobile side.

export interface CsvResponse<T> {
  headers: string[]
  rows: T[]
}

export interface BudgetRow {
  month: string
  category: string
  assigned: string
  rolled_over: string
}

export interface ExpenseRow {
  id?: string
  timestamp: string
  date: string
  item: string
  amount_inr: string
  category: string
  notes: string
  source: string
  amount: string
  description: string
  payment_method: string
}

export interface CategoryRow {
  name: string
  group: string
  alertPcts?: number[]
}

export interface CategoryMap {
  words: Record<string, string>
  updatedAt: string
}

export interface SubscriptionRow {
  timestamp: string
  service: string
  amount_inr: string
  billing_cycle: string
  next_due_date: string
  status: string
  renewal_or_end_month: string
  notes: string
}

export interface HoldingRow {
  name: string
  type: string
  value: string
  updated_at: string
  is_recurring: string
  recurring_amount: string
  recurring_day: string
  recurring_last_run: string
}

export interface HoldingEventRow {
  holding_name: string
  event_type: string
  amount: string
  previous_value: string
  new_value: string
  timestamp: string
}
