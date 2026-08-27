const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

/** IST calendar date ("YYYY-MM-DD") for a given instant. Mirrors Web's lib/http.ts::nowIST() —
 *  `new Date().toISOString()` alone yields the UTC calendar date, which is a day behind IST
 *  between 00:00–05:29 IST. */
export function toISTDateString(d: Date = new Date()): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

/** Today's IST calendar date. */
export function todayIST(): string {
  return toISTDateString()
}
