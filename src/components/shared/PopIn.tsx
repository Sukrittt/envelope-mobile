import { useEffect } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import Reanimated, { useSharedValue, useAnimatedStyle, withDelay, withSpring } from 'react-native-reanimated'

// Matches Heatmap.tsx's mount-pop spring for taste parity — deliberately
// bouncier than theme's motion.spring/springTight (src/theme/scale.ts),
// which are tuned for press/enter feedback, not a playful cold-mount pop.
const POP_SPRING = { mass: 0.7, damping: 12, stiffness: 160 }

interface Props {
  /** Read only on this instance's own mount, never reactively. */
  play: boolean
  delay: number
  style?: StyleProp<ViewStyle>
  children: React.ReactNode
}

/**
 * Same rationale as Heatmap.tsx's DayCell: `entering` doesn't reliably fire
 * for elements whose first-ever mount happens inside a ScrollView that's
 * part of the screen's own first paint, so the pop is driven explicitly via
 * a shared value instead.
 */
export function PopIn({ play, delay, style, children }: Props) {
  const progress = useSharedValue(play ? 0 : 1)

  useEffect(() => {
    if (!play) return
    progress.value = withDelay(delay, withSpring(1, POP_SPRING))
    // Intentionally runs once for this instance's own mount — `play` and `delay`
    // are read only for their initial value, not tracked reactively.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const animStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.92 + progress.value * 0.08 }, { translateY: (1 - progress.value) * 6 }],
  }))

  return <Reanimated.View style={[style, animStyle]}>{children}</Reanimated.View>
}
