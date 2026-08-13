import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '@/src/theme/ThemeProvider'

export interface HeatmapCell {
  date: string
  day: number
  value: number
}

interface Props {
  cells: HeatmapCell[]
  todayDate?: string
}

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Calendar heatmap of daily spend — 7-column grid, 5 shading levels, matching dc.html's Insights panel. */
export function Heatmap({ cells, todayDate }: Props) {
  const { tokens } = useTheme()
  const max = Math.max(...cells.map((c) => c.value), 1)
  const rows: HeatmapCell[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))

  return (
    <View>
      <View style={styles.row}>
        {DAY_HEADERS.map((d) => (
          <Text key={d} style={[styles.headerCell, { color: tokens.text3 }]}>
            {d}
          </Text>
        ))}
      </View>
      {rows.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((c) => {
            if (c.day === 0) return <View key={c.date} style={styles.cell} />
            const level = c.value === 0 ? 0 : Math.ceil((c.value / max) * 4)
            const bg =
              level <= 1 ? tokens.chipActiveBg : level === 2 ? tokens.heatA : level === 3 ? tokens.heatB : tokens.gold
            const textColor = level <= 1 ? tokens.text2 : tokens.onAccent
            const isToday = c.date === todayDate
            return (
              <View
                key={c.date}
                style={[
                  styles.cell,
                  styles.filledCell,
                  { backgroundColor: bg, borderColor: isToday ? tokens.mint : 'transparent' },
                ]}
              >
                <Text style={{ color: textColor, fontSize: 9 }}>{c.day}</Text>
              </View>
            )
          })}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, marginTop: 4 },
  headerCell: { flex: 1, textAlign: 'center', fontSize: 9 },
  cell: { flex: 1, aspectRatio: 1 },
  filledCell: { alignItems: 'center', justifyContent: 'center', borderRadius: 6, borderWidth: 1.5 },
})
