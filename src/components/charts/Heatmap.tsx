import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '@/src/theme/ThemeProvider'

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
  const max = Math.max(...cells.map((c) => c.value), 1)
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
          {row.map((c) => {
            if (c.day === 0) return <View key={c.date} style={styles.cell} />
            const isToday = c.date === todayDate
            const isFuture = !!todayDate && c.date > todayDate
            const level = c.value === 0 ? 0 : Math.ceil((c.value / max) * 4)
            const bg = isFuture
              ? tokens.card
              : level <= 1
                ? tokens.chipActiveBg
                : level === 2
                  ? tokens.heatA
                  : level === 3
                    ? tokens.heatB
                    : tokens.gold
            const textColor = isFuture ? tokens.text3 : level <= 1 ? tokens.text2 : tokens.onAccent
            const borderColor = isToday ? tokens.mint : isFuture ? tokens.borderStrong : 'transparent'
            return (
              <Pressable
                key={c.date}
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
              </Pressable>
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
