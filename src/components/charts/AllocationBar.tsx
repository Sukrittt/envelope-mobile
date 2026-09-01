import { useEffect, useRef } from 'react'
import { View, Text, Animated, Easing, StyleSheet } from 'react-native'
import Svg, { Rect } from 'react-native-svg'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'

const AnimatedRect = Animated.createAnimatedComponent(Rect)

// Mount-only reveal: the whole bar sweeps open once, not on every data refetch.
const GROW_DELAY = 120
const GROW_DURATION = 550

export interface AllocationSegment {
  label: string
  value: number
  color: string
}

/** Stacked horizontal bar + legend. Percentages are value/total*100 so they always sum to 100. */
export function AllocationBar({ segments }: { segments: AllocationSegment[] }) {
  const { tokens } = useTheme()
  const total = segments.reduce((s, seg) => s + seg.value, 0)

  // Hooks must run unconditionally — declared above the `total <= 0` bail-out below.
  const progress = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: GROW_DURATION,
      delay: GROW_DELAY,
      easing: Easing.out(Easing.cubic),
      // Width is a layout prop on an SVG Rect, not native-driver-friendly (same as ProgressBar's fill tween).
      useNativeDriver: false,
    }).start()
    // Mount-only: segment data changing later shouldn't replay the grow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (total <= 0) return null

  let cursor = 0
  const bars = segments.map((seg) => {
    const pct = (seg.value / total) * 100
    const bar = { key: seg.label, x: cursor, width: pct, color: seg.color }
    cursor += pct
    return bar
  })

  return (
    <View style={styles.wrap}>
      <View style={[styles.barClip, { backgroundColor: tokens.border }]}>
        <Svg width="100%" height={10} viewBox="0 0 100 10" preserveAspectRatio="none">
          {bars.map((b) => (
            <AnimatedRect
              key={b.key}
              x={b.x}
              y={0}
              width={progress.interpolate({ inputRange: [0, 1], outputRange: [0, b.width] })}
              height={10}
              fill={b.color}
            />
          ))}
        </Svg>
      </View>
      <View style={styles.legend}>
        {segments.map((seg) => {
          const pct = (seg.value / total) * 100
          return (
            <View key={seg.label} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: seg.color }]} />
              <Text
                style={[styles.legendLabel, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}
                numberOfLines={1}
              >
                {seg.label}
              </Text>
              <Text style={[styles.legendPct, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>
                {pct.toFixed(1)}%
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  barClip: { borderRadius: 6, overflow: 'hidden' },
  legend: { gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 13 },
  legendPct: { fontSize: 13 },
})
