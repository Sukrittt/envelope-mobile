// Pure transform from the same EnvelopeState/ExpenseRow[] every screen renders
// from, into the small shape the widgets need. No network, no auth, no
// storage here — that's what makes this the only part of the widgets worth
// unit-testing.
import { splitEmoji } from '@/src/lib/emoji'
import { formatINR } from '@/src/lib/format'
import type { Envelope, EnvelopeState } from '@/src/lib/envelope'
import type { ExpenseRow } from '@/src/types'

export interface WidgetRow {
  icon: string
  name: string
  pct: number
  available: string
  overspent: boolean
}

export interface WidgetChip {
  category: string
  label: string
  uri: string
}

export interface WidgetToday {
  item: string
  amount: string
}

export interface WidgetData {
  totalLeft: string
  daysLeft: number
  updatedAt: number
  rows: WidgetRow[]
  chips: WidgetChip[]
  today: WidgetToday[]
}

const ROW_COUNT = 5
const CHIP_COUNT = 3
const TODAY_COUNT = 3

function isReal(e: Envelope): boolean {
  return !e.isCreditCardPayment && e.assigned > 0
}

/** Worst-off envelopes first — the ones worth a glance without opening the app. */
export function selectRows(state: EnvelopeState): WidgetRow[] {
  return [...state.envelopes]
    .filter(isReal)
    .sort((a, b) => b.spentPct - a.spentPct)
    .slice(0, ROW_COUNT)
    .map((e) => {
      const { icon, text } = splitEmoji(e.category)
      return {
        icon,
        name: text,
        pct: e.spentPct,
        available: formatINR(Math.round(e.available)),
        overspent: e.isOverspent,
      }
    })
}

/** Most-used categories this month — the ones worth a one-tap shortcut.
 *  `label` is the button text: full category name, sentence case, emoji-free —
 *  the native `truncate="END"` handles anything still too long to fit. */
export function selectChips(state: EnvelopeState): WidgetChip[] {
  return [...state.envelopes]
    .filter(isReal)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, CHIP_COUNT)
    .map((e) => {
      const { text } = splitEmoji(e.category)
      return {
        category: e.category,
        label: text,
        uri: `mobile://modals/log-expense?category=${encodeURIComponent(e.category)}`,
      }
    })
}

/** Today's spends, most recent first — the one thing here not already
 *  glanceable from the Home tab. */
export function selectToday(expenses: ExpenseRow[], todayDate: string): WidgetToday[] {
  return expenses
    .filter((e) => e.date === todayDate)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, TODAY_COUNT)
    .map((e) => ({
      item: e.item,
      amount: formatINR(Math.round(Number(e.amount_inr) || 0)),
    }))
}

const DAY_MS = 86_400_000

/** "N days left" while the snapshot is fresh, matching Home's "12 days left";
 *  once the app hasn't run in over a day, flip wholesale to how stale the
 *  numbers are rather than let a silently-frozen snapshot pass as live. */
export function headerRightLabel(daysLeft: number, updatedAt: number, now: number = Date.now()): string {
  const ageMs = now - updatedAt
  if (ageMs < DAY_MS) {
    if (daysLeft === 0) return 'Less than 24 hrs'
    return daysLeft === 1 ? '1 day left' : `${daysLeft} days left`
  }
  const staleDays = Math.floor(ageMs / DAY_MS)
  return staleDays === 1 ? 'Updated 1 day ago' : `Updated ${staleDays} days ago`
}

export interface WidgetLayout {
  rows: number
  today: number
  buttons: number
  actionHeight: number
}

/** Breakpoints for the large (resizable) widget, driven by the dp size Android
 *  actually hands the renderer — not device heuristics, since that's all we
 *  can observe. Bar/Mini don't resize, so they don't call this.
 *
 *  Row height grew when rows picked up an icon + colored amount + a real 5dp
 *  bar (was a hairline), so these bands sit higher than before. 48dp is
 *  Material's touch-target minimum for the action row; 40dp at the two
 *  shortest bands is a deliberate concession — the widget itself is only
 *  165-210dp tall there, and 48 would eat a quarter of it. */
export function layoutFor(width: number, height: number): WidgetLayout {
  let rows: number
  let today: number
  let actionHeight: number
  if (height >= 320) {
    rows = 5
    today = 3
    actionHeight = 48
  } else if (height >= 260) {
    rows = 4
    today = 2
    actionHeight = 48
  } else if (height >= 210) {
    rows = 3
    today = 0
    actionHeight = 40
  } else if (height >= 165) {
    rows = 2
    today = 0
    actionHeight = 40
  } else {
    rows = 0
    today = 0
    actionHeight = 40
  }
  return { rows, today, buttons: width < 200 ? 2 : 3, actionHeight }
}

export function toWidgetData(state: EnvelopeState, expenses: ExpenseRow[], daysLeft: number, todayDate: string): WidgetData {
  const totalLeft = state.envelopes.filter((e) => !e.isCreditCardPayment).reduce((sum, e) => sum + e.available, 0)
  return {
    totalLeft: formatINR(Math.round(totalLeft)),
    daysLeft,
    updatedAt: Date.now(),
    rows: selectRows(state),
    chips: selectChips(state),
    today: selectToday(expenses, todayDate),
  }
}
