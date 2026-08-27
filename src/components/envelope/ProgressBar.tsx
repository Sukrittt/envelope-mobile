import { useEffect, useRef, useState } from 'react'
import { View, Animated, Easing, StyleSheet, type LayoutChangeEvent } from 'react-native'
import { useTheme } from '@/src/theme/ThemeProvider'

const clamp = (n: number) => Math.max(0, Math.min(100, n))

/** The fill waits out the block's own entrance before it moves, then takes long
 *  enough to be watched — at motion.slow it was over before the eye found it. */
const FILL_DELAY = 1000
const FILL_DURATION = 900

/** Spend-vs-assigned bar.
 * pct===100 -> muted, >90 -> coral, >75 -> warn, else mint.
 *
 * `from` turns the fill into a tween: the bar holds at that percentage and then
 * slides to `pct`. Reserve it for showing a *change* (the expense that was just
 * logged eating into its envelope) — a list of bars all animating is noise. */
export function ProgressBar({ pct, from }: { pct: number; from?: number }) {
  const { tokens } = useTheme()
  const [trackWidth, setTrackWidth] = useState(0)
  const clamped = clamp(pct)
  const color = pct === 100 ? tokens.text3 : pct > 90 ? tokens.coral : pct > 75 ? tokens.warn : tokens.mint

  const animated = from != null
  const onLayout = animated ? (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width) : undefined

  return (
    <View testID="progress-bar-track" style={[styles.track, { backgroundColor: tokens.borderStrong }]} onLayout={onLayout}>
      {animated ? (
        <AnimatedFill from={clamp(from)} to={clamped} color={color} trackWidth={trackWidth} />
      ) : (
        <View testID="progress-bar-fill" style={[styles.fill, { width: `${clamped}%`, backgroundColor: color }]} />
      )}
    </View>
  )
}

/**
 * RN core Animated rather than Reanimated: a plain width tween with no worklet,
 * and it keeps the primitive renderable under Jest (same call as AmountText).
 *
 * Animates pixels off the measured track rather than a percentage-string
 * interpolation — under Fabric the interpolated `'x%'` width painted as an empty
 * bar until the animation ran, so the starting position was never seen.
 */
function AnimatedFill({
  from,
  to,
  color,
  trackWidth,
}: {
  from: number
  to: number
  color: string
  trackWidth: number
}) {
  const width = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (trackWidth === 0) return
    width.setValue((from / 100) * trackWidth)
    Animated.timing(width, {
      toValue: (to / 100) * trackWidth,
      duration: FILL_DURATION,
      delay: FILL_DELAY,
      // Eased at both ends: it crept off the mark but stopped dead before.
      easing: Easing.inOut(Easing.cubic),
      // Layout props can't be driven natively.
      useNativeDriver: false,
    }).start()
  }, [width, from, to, trackWidth])

  return <Animated.View testID="progress-bar-fill" style={[styles.fill, { width, backgroundColor: color }]} />
}

const styles = StyleSheet.create({
  track: { height: 5, borderRadius: 100, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 100 },
})
