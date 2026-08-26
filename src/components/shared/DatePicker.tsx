import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Calendar, ChevronDown } from 'lucide-react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAY_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const WEEKDAY_SHORT3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function parseISO(value: string): Date | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const key = (d: Date) => d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate()
const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const fmt = (d: Date | null) => (d ? `${d.getDate()} ${SHORT[d.getMonth()]} ${d.getFullYear()}` : '—')
const dayDiff = (a: Date, b: Date) =>
  Math.round((new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime() - new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()) / 86400000)

interface Cell {
  day: string
  date: Date | null
  disabled: boolean
  isToday: boolean
  isSelected: boolean
}

function buildCells(view: Date, today: Date, selected: Date | null, disableFuture: boolean): Cell[] {
  const first = monthStart(view)
  const lead = (first.getDay() + 6) % 7
  const daysIn = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate()
  const kSel = selected ? key(selected) : null
  const kToday = key(today)
  const cells: Cell[] = []
  for (let i = 0; i < lead; i++) cells.push({ day: '', date: null, disabled: true, isToday: false, isSelected: false })
  for (let day = 1; day <= daysIn; day++) {
    const d = new Date(view.getFullYear(), view.getMonth(), day)
    const k = key(d)
    cells.push({
      day: String(day),
      date: d,
      disabled: disableFuture && k > kToday,
      isToday: k === kToday,
      isSelected: kSel === k,
    })
  }
  return cells
}

const QUICK: [string, number][] = [['Today', 0], ['Yesterday', -1], ['A week ago', -7]]

export interface DateRange {
  from: string
  to: string
}

interface SingleProps {
  mode: 'single'
  value: string
  onChange: (value: string) => void
  disableFuture?: boolean
}

interface RangeProps {
  mode: 'range'
  value: DateRange
  onChange: (value: DateRange) => void
  disableFuture?: boolean
}

type Props = SingleProps | RangeProps

const RANGE_PRESETS: [string, number, boolean][] = [
  ['This month', 0, true],
  ['Last 7 days', 7, false],
  ['Last 30 days', 30, false],
  ['Last 90 days', 90, false],
]

export function DatePicker(props: Props) {
  if (props.mode === 'range') return <RangeDatePicker {...props} />
  return <SingleDatePicker {...props} />
}

function RangeDatePicker({ value, onChange, disableFuture = true }: RangeProps) {
  const { tokens } = useTheme()
  const [open, setOpen] = useState(false)
  const today = new Date()
  const from = parseISO(value.from)
  const to = parseISO(value.to)
  const [view, setView] = useState(() => monthStart(from ?? today))

  const cells = buildCells(view, today, from, disableFuture)
  const kFrom = from ? key(from) : null
  const kTo = to ? key(to) : null

  function pick(d: Date) {
    const k = key(d)
    if (!from || (from && to)) {
      onChange({ from: toISO(d), to: '' })
    } else if (k < kFrom!) {
      onChange({ from: toISO(d), to: value.from })
    } else {
      onChange({ from: value.from, to: toISO(d) })
    }
  }

  function applyPreset(days: number, useMonthStart: boolean) {
    const end = today
    const start = useMonthStart ? new Date(today.getFullYear(), today.getMonth(), 1) : addDays(today, -(days - 1))
    onChange({ from: toISO(start), to: toISO(end) })
    setView(monthStart(start))
  }

  const label = from && to ? `${fmt(from)} – ${fmt(to)}` : from ? 'Pick an end date' : 'Custom range'

  return (
    <View>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={[styles.field, { backgroundColor: tokens.inputBg, borderColor: open ? tokens.accent : tokens.border }]}
      >
        <View style={styles.fieldLeft}>
          <View style={[styles.iconWrap, { backgroundColor: tokens.accentSoft }]}>
            <Calendar size={15} color={tokens.accentInk} />
          </View>
          <Text style={[styles.fieldText, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>{label}</Text>
        </View>
        <ChevronDown size={16} color={tokens.text3} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </Pressable>

      {open && (
        <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.borderStrong }]}>
          <View style={styles.quick}>
            {RANGE_PRESETS.map(([pLabel, days, useMonthStart]) => (
              <Pressable
                key={pLabel}
                onPress={() => applyPreset(days, useMonthStart)}
                style={[styles.chip, { borderColor: tokens.borderStrong, backgroundColor: 'transparent' }]}
              >
                <Text style={[styles.chipText, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>{pLabel}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.nav}>
            <Pressable
              onPress={() => setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))}
              style={[styles.navBtn, { backgroundColor: tokens.inputBg, borderColor: tokens.border }]}
            >
              <Text style={[styles.navBtnText, { color: tokens.text }]}>‹</Text>
            </Pressable>
            <Text style={[styles.monthLabel, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
              {MONTHS[view.getMonth()]} {view.getFullYear()}
            </Text>
            <Pressable
              onPress={() => setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))}
              style={[styles.navBtn, { backgroundColor: tokens.inputBg, borderColor: tokens.border }]}
            >
              <Text style={[styles.navBtnText, { color: tokens.text }]}>›</Text>
            </Pressable>
          </View>

          <View style={styles.weekdays}>
            {WEEKDAY_SHORT.map((w, i) => (
              <Text key={i} style={[styles.weekday, { color: tokens.text3 }]}>
                {w}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {Array.from({ length: Math.ceil(cells.length / 7) }, (_, row) => (
              <View key={row} style={styles.gridRow}>
                {Array.from({ length: 7 }, (_, i) => cells[row * 7 + i]).map((c, i) => {
                  const k = c?.date ? key(c.date) : null
                  const isStart = k !== null && k === kFrom
                  const isEnd = k !== null && k === kTo
                  const inRange = kFrom !== null && kTo !== null && k !== null && k > kFrom && k < kTo
                  return (
                    <View
                      key={i}
                      style={[styles.cellWrap, inRange && { backgroundColor: tokens.accentSoft }]}
                    >
                      {c?.date && (
                        <Pressable
                          disabled={c.disabled}
                          onPress={() => pick(c.date!)}
                          style={[
                            styles.cell,
                            { borderColor: c.isToday && !isStart && !isEnd ? tokens.accent : 'transparent' },
                            (isStart || isEnd) && { backgroundColor: tokens.accent },
                            c.disabled && { opacity: 0.4 },
                          ]}
                        >
                          <Text
                            style={[
                              styles.cellText,
                              {
                                color: c.disabled ? tokens.text3 : isStart || isEnd ? tokens.onAccent : tokens.text,
                                fontFamily: fontFamily.bodySemiBold,
                              },
                            ]}
                          >
                            {c.day}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  )
                })}
              </View>
            ))}
          </View>

          <View style={styles.rangeFooter}>
            <Pressable onPress={() => onChange({ from: '', to: '' })} style={[styles.clear, { borderColor: tokens.borderStrong }]}>
              <Text style={[styles.clearText, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>Clear</Text>
            </Pressable>
            <Pressable
              onPress={() => setOpen(false)}
              style={[styles.done, { backgroundColor: tokens.accentSoft, flex: 1, alignItems: 'center' }]}
            >
              <Text style={[styles.doneText, { color: tokens.accentInk, fontFamily: fontFamily.bodyBold }]}>Done</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  )
}

function SingleDatePicker({ value, onChange, disableFuture = true }: SingleProps) {
  const { tokens } = useTheme()
  const [open, setOpen] = useState(false)
  const today = new Date()
  const selected = parseISO(value)
  const [view, setView] = useState(() => monthStart(selected ?? today))

  function toggle() {
    if (!open) setView(monthStart(selected ?? today))
    setOpen((o) => !o)
  }

  function pick(d: Date) {
    onChange(toISO(d))
    setView(monthStart(d))
  }

  const cells = buildCells(view, today, selected, disableFuture)
  const kToday = key(today)
  const kYesterday = key(addDays(today, -1))
  const kSel = selected ? key(selected) : null

  const stripDays = Array.from({ length: 6 }, (_, i) => addDays(today, i - 5))
  function stripLabel(d: Date) {
    const k = key(d)
    if (k === kToday) return 'Today'
    if (k === kYesterday) return 'Yest'
    return WEEKDAY_SHORT3[d.getDay()]
  }

  let daysAgoText = ''
  if (selected) {
    const diff = dayDiff(today, selected)
    daysAgoText = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : diff > 1 ? `${diff} days ago` : 'In the future'
  }

  return (
    <View>
      <View style={styles.dateHeader}>
        <Text style={[styles.dateHeaderLabel, { color: tokens.text3, fontFamily: fontFamily.bodySemiBold }]}>DATE</Text>
        {!!daysAgoText && <Text style={[styles.daysAgo, { color: tokens.text3, fontFamily: fontFamily.bodySemiBold }]}>{daysAgoText}</Text>}
      </View>

      <View style={styles.strip}>
        {stripDays.map((d) => {
          const k = key(d)
          const active = kSel === k
          return (
            <Pressable
              key={k}
              onPress={() => pick(d)}
              style={[
                styles.stripCell,
                { backgroundColor: active ? tokens.accent : tokens.inputBg, borderColor: active ? tokens.accent : tokens.border },
              ]}
            >
              <Text style={[styles.stripDay, { color: active ? tokens.onAccent : tokens.text3, fontFamily: fontFamily.bodySemiBold }]}>
                {stripLabel(d)}
              </Text>
              <Text style={[styles.stripNum, { color: active ? tokens.onAccent : tokens.text, fontFamily: fontFamily.bodyBold }]}>{d.getDate()}</Text>
            </Pressable>
          )
        })}
      </View>

      {!open && (
        <Pressable onPress={toggle}>
          <Text style={[styles.link, { color: tokens.accent, fontFamily: fontFamily.bodySemiBold }]}>Another date...</Text>
        </Pressable>
      )}

      {open && (
        <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.borderStrong }]}>
          <View style={styles.quick}>
            {QUICK.map(([qLabel, off]) => {
              const d = addDays(today, off)
              const active = !!selected && key(selected) === key(d)
              return (
                <Pressable
                  key={qLabel}
                  onPress={() => pick(d)}
                  style={[
                    styles.chip,
                    { borderColor: active ? 'transparent' : tokens.borderStrong, backgroundColor: active ? tokens.accent : 'transparent' },
                  ]}
                >
                  <Text style={[styles.chipText, { color: active ? tokens.onAccent : tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>
                    {qLabel}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <View style={styles.nav}>
            <Pressable
              onPress={() => setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))}
              style={[styles.navBtn, { backgroundColor: tokens.inputBg, borderColor: tokens.border }]}
            >
              <Text style={[styles.navBtnText, { color: tokens.text }]}>‹</Text>
            </Pressable>
            <Text style={[styles.monthLabel, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
              {MONTHS[view.getMonth()]} {view.getFullYear()}
            </Text>
            <Pressable
              onPress={() => setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))}
              style={[styles.navBtn, { backgroundColor: tokens.inputBg, borderColor: tokens.border }]}
            >
              <Text style={[styles.navBtnText, { color: tokens.text }]}>›</Text>
            </Pressable>
          </View>

          <View style={styles.weekdays}>
            {WEEKDAY_SHORT.map((w, i) => (
              <Text key={i} style={[styles.weekday, { color: tokens.text3 }]}>
                {w}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {Array.from({ length: Math.ceil(cells.length / 7) }, (_, row) => (
              <View key={row} style={styles.gridRow}>
                {Array.from({ length: 7 }, (_, i) => cells[row * 7 + i]).map((c, i) => (
                  <View key={i} style={styles.cellWrap}>
                    {c?.date && (
                      <Pressable
                        disabled={c.disabled}
                        onPress={() => pick(c.date!)}
                        style={[
                          styles.cell,
                          { borderColor: c.isToday && !c.isSelected ? tokens.accent : 'transparent' },
                          c.isSelected && { backgroundColor: tokens.accent },
                          c.disabled && { opacity: 0.4 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.cellText,
                            { color: c.disabled ? tokens.text3 : c.isSelected ? tokens.onAccent : tokens.text, fontFamily: fontFamily.bodySemiBold },
                          ]}
                        >
                          {c.day}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      )}

      {open && (
        <Pressable onPress={() => setOpen(false)}>
          <Text style={[styles.link, { color: tokens.accent, fontFamily: fontFamily.bodySemiBold }]}>Close calendar</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 16, borderWidth: 1 },
  fieldLeft: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 },
  iconWrap: { width: 30, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  fieldText: { fontSize: 14 },
  card: { marginTop: 10, padding: 12, borderRadius: 18, borderWidth: 1, gap: 10 },
  quick: { flexDirection: 'row', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: 100, borderWidth: 1 },
  chipText: { fontSize: 12 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  navBtnText: { fontSize: 14 },
  monthLabel: { fontSize: 14 },
  weekdays: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 10 },
  grid: { gap: 2 },
  gridRow: { flexDirection: 'row' },
  cellWrap: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center' },
  cell: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontSize: 13 },
  done: { alignSelf: 'flex-end', paddingVertical: 9, paddingHorizontal: 18, borderRadius: 100 },
  doneText: { fontSize: 12.5 },
  rangeFooter: { flexDirection: 'row', gap: 8 },
  clear: { paddingVertical: 9, paddingHorizontal: 18, borderRadius: 100, borderWidth: 1 },
  clearText: { fontSize: 12.5 },
  dateHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  dateHeaderLabel: { fontSize: 11, letterSpacing: 0.5 },
  daysAgo: { fontSize: 11 },
  strip: { flexDirection: 'row', gap: 6 },
  stripCell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 14, borderWidth: 1, gap: 2 },
  stripDay: { fontSize: 10 },
  stripNum: { fontSize: 15 },
  link: { fontSize: 13, marginTop: 10 },
})
