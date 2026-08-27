import { useEffect, useRef } from 'react'
import { View, Animated, Easing, StyleSheet } from 'react-native'
import { useTheme } from '@/src/theme/ThemeProvider'

const clamp = (n: number) => Math.max(0, Math.min(100, n))

/** The fill waits out the block's own entrance before it moves, then takes long
 *  enough to be watched — at motion.slow it was over before the eye found it. */
const FILL_DELAY = 1000
const FILL_DURATION = 900

/** Spend-vs-assigned bar.
 * pct===100 -> muted, >90 -> coral, >75 -> warn, else mint.
 *
 * `from` turns the fill into a tween: the bar starts at that percentage and
 * slides to `pct`. Reserve it for showing a *change* (the expense that was just
 * logged eating into its envelope) — a list of bars all animating is noise. */
export function ProgressBar({ pct, from }: { pct: number; from?: number }) {
  const { tokens } = useTheme()
  const clamped = clamp(pct)
  const color = pct === 100 ? tokens.text3 : pct > 90 ? tokens.coral : pct > 75 ? tokens.warn : tokens.mint

  return (
    <View style={[styles.track, { backgroundColor: tokens.borderStrong }]}>
      {from == null ? (
        <View testID="progress-bar-fill" style={[styles.fill, { width: `${clamped}%`, backgroundColor: color }]} />
      ) : (
        <AnimatedFill from={clamp(from)} to={clamped} color={color} />
      )}
    </View>
  )
}

/** RN core Animated rather than Reanimated: a plain width tween with no worklet,
 *  and it keeps the primitive renderable under Jest (same call as AmountText). */
function AnimatedFill({ from, to, color }: { from: number; to: number; color: string }) {
  const progress = useRef(new Animated.Value(from)).current

  useEffect(() => {
    Animated.timing(progress, {
      toValue: to,
      duration: FILL_DURATION,
      delay: FILL_DELAY,
      easing: Easing.in(Easing.cubic),
      // Width percentages can't be driven natively.
      useNativeDriver: false,
    }).start()
  }, [progress, to])

  const width = progress.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] })

  return <Animated.View testID="progress-bar-fill" style={[styles.fill, { width, backgroundColor: color }]} />
}

const styles = StyleSheet.create({
  track: { height: 5, borderRadius: 100, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 100 },
})
