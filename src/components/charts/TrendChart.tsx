import { useEffect } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import Svg, { Rect, Line } from 'react-native-svg'
import Reanimated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { formatCurrency } from '@/src/lib/format'
import { monthAbbrev } from '@/src/lib/envelope'

const AnimatedRect = Reanimated.createAnimatedComponent(Rect)

export interface TrendPoint {
  /** Month key, "YYYY-MM". */
  date: string
  value: number
}

interface Props {
  data: TrendPoint[]
  /** Mean of the trailing months, drawn as a dashed reference line. Omit to
   *  hide it (not enough history yet). */
  baseline?: number | null
  /** Month key of the bar to highlight solid; the rest sit at reduced opacity. */
  selectedKey?: string | null
  height?: number
  hideAmounts?: boolean
  /** Tapping a bar moves the screen's selected month. */
  onSelect?: (key: string) => void
  /** Month key still in progress. Its bar stays at full opacity regardless of
   *  selection (opacity means "not selected" everywhere else, and reusing it
   *  for "partial" reads as disabled) and its axis label gets a `*` plus a
   *  caption spelling out what the asterisk means. */
  partialKey?: string | null
  partialNote?: string | null
}

const VIEW_W = 800
const VIEW_H = 250
const PAD_TOP = 35
const PAD_BOTTOM = 25
const PAD_X = 8
const MAX_BAR_W = 56
const STAGGER_STEP = 30
const GROW_DURATION = 350

/** Compact axis label: 1234 -> "₹1.2k", 950 -> "₹950". */
function compactAxis(value: number, hide: boolean): string {
  if (hide) return '₹••'
  if (value >= 1000) return `₹${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`
  return `₹${Math.round(value)}`
}

interface BarProps {
  x: number
  y: number
  w: number
  h: number
  index: number
  signature: string
  fill: string
  fillOpacity: number
  reducedMotion: boolean
}

/** Single bar, grown from the baseline with a per-index stagger delay. Regrows
 *  whenever `signature` changes (month navigation swaps the data). */
function Bar({ x, y, w, h, index, signature, fill, fillOpacity, reducedMotion }: BarProps) {
  const grow = useSharedValue(reducedMotion ? 1 : 0)

  useEffect(() => {
    grow.value = reducedMotion
      ? 1
      : withDelay(index * STAGGER_STEP, withTiming(1, { duration: GROW_DURATION, easing: Easing.out(Easing.cubic) }))
    // signature (not index) is what should retrigger the grow-in on data swaps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, reducedMotion])

  const animatedProps = useAnimatedProps(() => ({
    height: h * grow.value,
    y: y + h * (1 - grow.value),
  }))

  return <AnimatedRect animatedProps={animatedProps} x={x} width={w} rx={4} fill={fill} fillOpacity={fillOpacity} />
}

/** Trailing-12-months bar chart. Bars only (a smoothed area over discrete
 *  months implied a continuity that wasn't there) with a dashed baseline so
 *  the card can answer "is this normal" instead of just "it went up". */
export function TrendChart({
  data,
  baseline,
  selectedKey,
  height = 200,
  hideAmounts = false,
  onSelect,
  partialKey,
  partialNote,
}: Props) {
  const { tokens } = useTheme()
  const reducedMotion = useReducedMotion()
  const signature = data.map((d) => `${d.date}:${d.value}`).join('|')

  if (data.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={{ color: tokens.text3, fontFamily: fontFamily.bodyMedium, fontSize: 12 }}>
          No spending data yet
        </Text>
      </View>
    )
  }

  const max = Math.max(...data.map((d) => d.value), baseline ?? 0, 1)
  const n = data.length
  const plotH = VIEW_H - PAD_TOP - PAD_BOTTOM
  const barGap = 8
  const slot = (VIEW_W - PAD_X * 2) / n
  const barW = Math.min(MAX_BAR_W, Math.max(6, slot - barGap))

  const bars = data.map((d, i) => {
    const h = Math.max(2, (d.value / max) * plotH)
    return {
      key: d.date,
      value: d.value,
      x: PAD_X + i * slot + (slot - barW) / 2,
      y: VIEW_H - PAD_BOTTOM - h,
      w: barW,
      h,
    }
  })

  const baselineY = baseline != null ? VIEW_H - PAD_BOTTOM - (baseline / max) * plotH : null
  const selected = selectedKey != null ? bars.find((b) => b.key === selectedKey) : undefined

  return (
    <View>
      <View style={styles.axisRow}>
        <Text style={[styles.axisLabel, { color: tokens.text3 }]}>{compactAxis(max, hideAmounts)}</Text>
        {baseline != null && (
          <Text style={[styles.axisLabel, { color: tokens.text3 }]}>avg {compactAxis(baseline, hideAmounts)}</Text>
        )}
      </View>
      <View style={{ height }}>
        <Svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width="100%" height={height}>
          {baselineY != null && (
            <Line
              x1={PAD_X}
              x2={VIEW_W - PAD_X}
              y1={baselineY}
              y2={baselineY}
              stroke={tokens.text3}
              strokeWidth={1.5}
              strokeDasharray="4,5"
            />
          )}
          {bars.map((b, i) => {
            const isSelected = selected ? b.key === selected.key : false
            const dimmed = selected != null && !isSelected && b.key !== partialKey
            return (
              <Bar
                key={b.key}
                x={b.x}
                y={b.y}
                w={b.w}
                h={b.h}
                index={i}
                signature={signature}
                fill={tokens.accent}
                fillOpacity={dimmed ? 0.55 : 1}
                reducedMotion={reducedMotion}
              />
            )
          })}
        </Svg>
        {selected && (
          <View pointerEvents="none" style={[styles.valueTag, { left: `${((selected.x + selected.w / 2) / VIEW_W) * 100}%` }]}>
            <Text style={[styles.valueTagText, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>
              {formatCurrency(selected.value, hideAmounts)}
            </Text>
          </View>
        )}
        {onSelect && (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <View style={styles.columnRow}>
              {data.map((d) => (
                <Pressable key={d.date} style={{ flex: 1 }} onPress={() => onSelect(d.date)} />
              ))}
            </View>
          </View>
        )}
      </View>
      <View style={styles.labelRow}>
        {data.map((d) => (
          <Text
            key={d.date}
            style={[
              styles.label,
              { color: d.date === selectedKey ? tokens.text : tokens.text3 },
              d.date === selectedKey && { fontFamily: fontFamily.bodySemiBold },
            ]}
          >
            {monthAbbrev(d.date)}
            {d.date === partialKey ? '*' : ''}
          </Text>
        ))}
      </View>
      {partialKey != null && partialNote && data.some((d) => d.date === partialKey) && (
        <Text style={[styles.partialNote, { color: tokens.text3 }]}>* {partialNote}</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 4 },
  axisLabel: { fontSize: 10 },
  columnRow: { flex: 1, flexDirection: 'row' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 4 },
  label: { fontSize: 9 },
  valueTag: { position: 'absolute', top: 4, marginLeft: -30, width: 60, alignItems: 'center' },
  valueTagText: { fontSize: 11 },
  partialNote: { fontSize: 10, paddingHorizontal: 4, paddingTop: 4 },
})
