/** One reviewable line on the bill-scan review screen. `divisor: null` = skipped (not mine at all). */
export type ScanItem = { name: string; price: number; divisor: number | null }

/** Round to 2dp, avoiding the classic *100 float wobble (1.005 -> 1.00). */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Sum of price/divisor across every non-skipped item, rounded to 2dp (paisa). */
export function computeShare(items: ScanItem[]): number {
  const total = items.reduce((sum, it) => (it.divisor ? sum + it.price / it.divisor : sum), 0)
  return round2(total)
}

/**
 * Appends a "Fees & taxes" row carrying whatever the line items don't already
 * account for (delivery fee, small-cart fee, a rounded-off total, ...). Line
 * items on a delivery-app cart rarely sum to the printed total, and without
 * this the computed share silently drops that difference on every such bill.
 * A no-op once diff is within a paisa of zero (float/rounding noise, not a
 * real missing charge).
 */
export function reconcile(total: number, items: { name: string; price: number }[]): { name: string; price: number }[] {
  const sum = items.reduce((s, it) => s + it.price, 0)
  const diff = round2(total - sum)
  if (Math.abs(diff) < 0.01) return items
  return [...items, { name: 'Fees & taxes', price: diff }]
}
