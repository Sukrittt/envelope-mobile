import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Calendar, ChevronDown } from 'lucide-react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAY_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

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

interface Props {
  mode: 'single'
  value: string
  onChange: (value: string) => void
  disableFuture?: boolean
}

export function DatePicker({ value, onChange, disableFuture = true }: Props) {
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
  const label = selected ? `${WEEKDAY_FULL[selected.getDay()]}, ${fmt(selected)}` : 'Select a date'

  return (
    <View>
      <Pressable
        onPress={toggle}
        style={[styles.field, { backgroundColor: tokens.inputBg, borderColor: open ? tokens.gold : tokens.border }]}
      >
        <View style={styles.fieldLeft}>
          <View style={[styles.iconWrap, { backgroundColor: tokens.goldSoft }]}>
            <Calendar size={15} color={tokens.gold} />
          </View>
          <Text style={[styles.fieldText, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>{label}</Text>
        </View>
        <ChevronDown size={16} color={tokens.text3} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </Pressable>

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
                    { borderColor: active ? 'transparent' : tokens.borderStrong, backgroundColor: active ? tokens.gold : 'transparent' },
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
            {cells.map((c, i) => (
              <View key={i} style={styles.cellWrap}>
                {c.date && (
                  <Pressable
                    disabled={c.disabled}
                    onPress={() => pick(c.date!)}
                    style={[
                      styles.cell,
                      { borderColor: c.isToday && !c.isSelected ? tokens.gold : 'transparent' },
                      c.isSelected && { backgroundColor: tokens.gold },
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

          <Pressable onPress={() => setOpen(false)} style={[styles.done, { backgroundColor: tokens.goldSoft }]}>
            <Text style={[styles.doneText, { color: tokens.gold, fontFamily: fontFamily.bodyBold }]}>Done</Text>
          </Pressable>
        </View>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cellWrap: { width: `${100 / 7}%`, height: 36, alignItems: 'center', justifyContent: 'center' },
  cell: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontSize: 13 },
  done: { alignSelf: 'flex-end', paddingVertical: 9, paddingHorizontal: 18, borderRadius: 100 },
  doneText: { fontSize: 12.5 },
})
