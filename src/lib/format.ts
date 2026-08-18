// INR currency formatting — Indian digit grouping (last 3 digits, then pairs),
// written by hand instead of `toLocaleString('en-IN')` since Hermes's ICU/Intl
// support varies by build and this is money math we need right everywhere.
export function formatINR(value: number): string {
  const rounded = Math.round(Math.abs(value))
  const sign = value < 0 ? '-' : ''
  const s = String(rounded)
  const last3 = s.slice(-3)
  const rest = s.slice(0, -3)
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3
  return `${sign}₹${grouped}`
}

/** Pass hide=true (the "hide amounts" toggle) to mask the value instead of formatting it. */
export function formatCurrency(value: number, hide = false): string {
  return hide ? '₹••••' : formatINR(value)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** e.g. "12 Aug, 3:45 PM" — used by Investments' holding rows and event history. */
export function formatDateTime(ts: string): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  const hours24 = d.getHours()
  const hours12 = hours24 % 12 || 12
  const ampm = hours24 < 12 ? 'AM' : 'PM'
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${hours12}:${minutes} ${ampm}`
}

/** e.g. "12 Aug 2026" — date-only, no time. */
export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
