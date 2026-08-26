import { View, StyleSheet } from 'react-native'
import { useTheme } from '@/src/theme/ThemeProvider'

/** Spend-vs-assigned bar.
 * pct===100 -> muted, >90 -> coral, >75 -> warn, else mint. */
export function ProgressBar({ pct }: { pct: number }) {
  const { tokens } = useTheme()
  const clamped = Math.max(0, Math.min(100, pct))
  const color = pct === 100 ? tokens.text3 : pct > 90 ? tokens.coral : pct > 75 ? tokens.warn : tokens.mint

  return (
    <View style={[styles.track, { backgroundColor: tokens.borderStrong }]}>
      <View testID="progress-bar-fill" style={[styles.fill, { width: `${clamped}%`, backgroundColor: color }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  track: { height: 5, borderRadius: 100, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 100 },
})
