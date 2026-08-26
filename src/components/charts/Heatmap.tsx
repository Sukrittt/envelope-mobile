import { useMemo } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import Reanimated, { ZoomIn, ZoomOut } from 'react-native-reanimated'
import { useTheme } from '@/src/theme/ThemeProvider'

const AnimatedPressable = Reanimated.createAnimatedComponent(Pressable)

export interface HeatmapCell {
  date: string
  day: number
  value: number
}

interface Props {
  cells: HeatmapCell[]
  todayDate?: string
  onSelectDate?: (date: string) => void
}

/** Calendar heatmap of daily spend — 7-column grid, 5 shading levels, matching dc.html's Insights panel. */
export function Heatmap({ cells, todayDate, onSelectDate }: Props) {
  const { tokens } = useTheme()

  // Percentile rank among non-zero days, not value/max — a single outlier day
  // would otherwise squash every other day into the "no color" bucket.
  const levels = useMemo(() => {
    const nonZero = cells.filter((c) => c.day > 0 && c.value > 0).map((c) => c.value).sort((a, b) => a - b)
    const map = new Map<string, number>()
    for (const c of cells) {
      if (c.day === 0 || c.value <= 0) continue
      const rank = nonZero.findIndex((v) => v >= c.value)
      const percentile = rank / nonZero.length
      map.set(c.date, Math.min(Math.floor(percentile * 4), 3) + 1)
    }
    return map
  }, [cells])

  const rows: HeatmapCell[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    const row = cells.slice(i, i + 7)
    while (row.length < 7) row.push({ date: `pad-${i}-${row.length}`, day: 0, value: 0 })
    rows.push(row)
  }

  return (
    <View>
      {rows.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((c, j) => {
            const pos = i * 7 + j // stable grid slot, unlike c.date which changes every month
            if (c.day === 0) return <View key={pos} style={styles.cell} />
            const isToday = c.date === todayDate
            const isFuture = !!todayDate && c.date > todayDate
            const level = levels.get(c.date) ?? 0
            const bg = isFuture
              ? tokens.card
              : level <= 1
                ? tokens.chipActiveBg
                : level === 2
                  ? tokens.heatA
                  : level === 3
                    ? tokens.heatB
                    : tokens.accent
            const textColor = isFuture ? tokens.text3 : level <= 1 ? tokens.text2 : tokens.onAccent
            const borderColor = isToday ? tokens.mint : isFuture ? tokens.borderStrong : 'transparent'
            return (
              <AnimatedPressable
                key={pos}
                entering={ZoomIn.springify().mass(0.5).damping(16).stiffness(500)}
                exiting={ZoomOut.springify().mass(0.5).damping(16).stiffness(500)}
                disabled={isFuture || !onSelectDate}
                onPress={() => onSelectDate?.(c.date)}
                style={[
                  styles.cell,
                  styles.filledCell,
                  {
                    backgroundColor: bg,
                    borderColor,
                    borderWidth: isToday ? 1.5 : isFuture ? 1 : 0,
                    borderStyle: isFuture && !isToday ? 'dashed' : 'solid',
                  },
                ]}
              >
                <Text style={{ color: textColor, fontSize: 11 }}>{c.day}</Text>
              </AnimatedPressable>
            )
          })}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, marginTop: 6 },
  cell: { flex: 1, aspectRatio: 1 },
  filledCell: { alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
})
