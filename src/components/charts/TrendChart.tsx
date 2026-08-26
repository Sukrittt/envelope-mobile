import { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import Svg, { Path, Rect, Defs, LinearGradient, Stop } from 'react-native-svg'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { formatCurrency } from '@/src/lib/format'

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export interface TrendPoint {
  date: string
  value: number
}

interface Props {
  data: TrendPoint[]
  variant: 'area' | 'bar'
  height?: number
  hideAmounts?: boolean
  /** Tapping a column drills into that point (e.g. month → its weeks). Omit to show a point-detail tooltip on tap instead. */
  onSelectIndex?: (index: number) => void
}

const VIEW_W = 800
const VIEW_H = 240
const PAD = 12

/** Catmull-Rom → cubic-bezier: smooth curve through every point, no external dep. */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 3) {
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  }
  let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }
  return d
}

/** Hand-rolled area/bar spending trend chart, matching dc.html's mobile "Spending trend" panel. */
export function TrendChart({ data, variant, height = 200, hideAmounts = false, onSelectIndex }: Props) {
  const { tokens } = useTheme()
  const [tooltipIndex, setTooltipIndex] = useState<number | null>(null)
  useEffect(() => setTooltipIndex(null), [data])

  const chart = useMemo(() => {
    if (data.length === 0) return null
    const max = Math.max(...data.map((d) => d.value), 1)
    const n = data.length
    const stepX = n > 1 ? (VIEW_W - PAD * 2) / (n - 1) : 0

    const points = data.map((d, i) => ({
      x: PAD + stepX * i,
      y: VIEW_H - PAD - (d.value / max) * (VIEW_H - PAD * 2),
    }))
    const path = smoothPath(points)
    const area = `${path} L${points[points.length - 1].x.toFixed(1)},${VIEW_H - PAD} L${points[0].x.toFixed(1)},${VIEW_H - PAD} Z`

    const barGap = 6
    const barW = Math.max(4, (VIEW_W - PAD * 2) / n - barGap)
    const bars = data.map((d, i) => {
      const barH = Math.max(2, (d.value / max) * (VIEW_H - PAD * 2))
      return {
        x: PAD + (i * (VIEW_W - PAD * 2)) / n,
        y: VIEW_H - PAD - barH,
        w: barW,
        h: barH,
      }
    })

    const tickCount = Math.min(5, n)
    const tickIdx = Array.from({ length: tickCount }, (_, i) =>
      Math.round((i * (n - 1)) / Math.max(1, tickCount - 1)),
    )
    const labels = tickIdx.map((i) => data[i].date.slice(5))

    return { path, area, bars, labels, points }
  }, [data])

  const tooltip = useMemo(() => {
    if (tooltipIndex == null || !chart) return null
    const row = data[tooltipIndex]
    const point = chart.points[tooltipIndex]
    if (!row || !point) return null

    const next = data[tooltipIndex + 1]
    const fmt = (d: Date) => `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
    let rangeLabel: string
    if (next) {
      const start = new Date(row.date)
      const end = new Date(next.date)
      end.setDate(end.getDate() - 1)
      rangeLabel = `${fmt(start)} – ${fmt(end)}`
    } else {
      rangeLabel = fmt(new Date(row.date))
    }

    const prev = data[tooltipIndex - 1]
    const deltaPct = prev && prev.value !== 0 ? ((row.value - prev.value) / prev.value) * 100 : null

    return { rangeLabel, value: row.value, deltaPct, x: point.x, y: point.y }
  }, [tooltipIndex, data, chart])

  if (!chart) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={{ color: tokens.text3, fontFamily: fontFamily.bodyMedium, fontSize: 12 }}>
          No spending data yet
        </Text>
      </View>
    )
  }

  return (
    <View>
      <View style={{ height }}>
        <Svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width="100%" height={height}>
          <Defs>
            <LinearGradient id="trendAreaFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={tokens.accent} stopOpacity={0.45} />
              <Stop offset="100%" stopColor={tokens.accent} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {variant === 'area' ? (
            <>
              <Path d={chart.area} fill="url(#trendAreaFill)" stroke="none" />
              <Path d={chart.path} fill="none" stroke={tokens.accent} strokeWidth={4} strokeLinecap="round" />
            </>
          ) : (
            chart.bars.map((b, i) => (
              <Rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={4} fill="url(#trendAreaFill)" stroke={tokens.accent} />
            ))
          )}
        </Svg>
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={styles.columnRow}>
            {data.map((_, i) => (
              <Pressable
                key={i}
                style={{ flex: 1 }}
                onPress={() => {
                  if (onSelectIndex) onSelectIndex(i)
                  else setTooltipIndex((cur) => (cur === i ? null : i))
                }}
              />
            ))}
          </View>
        </View>
        {tooltip && !onSelectIndex && (
          <View
            pointerEvents="none"
            style={[
              styles.tooltip,
              {
                left: `${(tooltip.x / VIEW_W) * 100}%`,
                top: Math.max(4, (tooltip.y / VIEW_H) * height - 74),
                backgroundColor: tokens.modalBg,
                borderColor: tokens.borderStrong,
              },
            ]}
          >
            <Text style={[styles.tooltipTitle, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>
              {tooltip.rangeLabel}
            </Text>
            <Text style={[styles.tooltipLine, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
              Total: {formatCurrency(tooltip.value, hideAmounts)}
            </Text>
            {tooltip.deltaPct != null && (
              <Text
                style={[
                  styles.tooltipLine,
                  { color: tooltip.deltaPct > 0 ? tokens.coral : tokens.mint, fontFamily: fontFamily.bodySemiBold },
                ]}
              >
                vs previous: {tooltip.deltaPct > 0 ? '▲' : '▼'} {Math.abs(tooltip.deltaPct).toFixed(1)}%
              </Text>
            )}
          </View>
        )}
      </View>
      <View style={styles.labelRow}>
        {chart.labels.map((l, i) => (
          <Text key={i} style={[styles.label, { color: tokens.text3 }]}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  columnRow: { flex: 1, flexDirection: 'row' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 4 },
  label: { fontSize: 9 },
  tooltip: {
    position: 'absolute',
    marginLeft: -70,
    width: 140,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 3,
  },
  tooltipTitle: { fontSize: 12 },
  tooltipLine: { fontSize: 11 },
})
