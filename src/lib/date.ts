const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Device-local calendar date ("YYYY-MM-DD") for a given instant. Everything the
 * user logs is dated by the day it is *for them*, matching how the server's
 * `nowIn(user.timezone)` dates the same user's cron work — see `syncTimezone`
 * in `src/api/account.ts`, which keeps the two zones aligned.
 */
export function toLocalDateString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Today's device-local calendar date. */
export function todayLocal(): string {
  return toLocalDateString()
}

/**
 * Local date + full offset-suffixed timestamp for right now, minted on the
 * device (`2026-09-21T08:30:15+05:30`) — the same shape as Web's
 * `lib/http.ts::nowIn()`. Used so an offline expense is stamped with the day it
 * was actually logged, not the day the queue happens to flush.
 */
// Keep in sync with Web/lib/http.ts.
export function nowLocal(at: Date = new Date()): { date: string; timestamp: string } {
  const offset = -at.getTimezoneOffset()
  const abs = Math.abs(offset)
  const date = toLocalDateString(at)
  const time = `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`
  const suffix = `${offset < 0 ? '-' : '+'}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  return { date, timestamp: `${date}T${time}${suffix}` }
}

/** The device's IANA timezone (e.g. `America/New_York`). */
export function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}
