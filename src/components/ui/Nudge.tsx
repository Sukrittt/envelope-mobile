import { useEffect } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import Reanimated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

/**
 * Points at a field the user skipped: a quick sideways wiggle plus a pop each
 * time `trigger` changes while `active`. Pairs with a highlight the caller
 * draws itself (border, colour), since that part is field-specific.
 */
export function Nudge({
  trigger,
  active,
  style,
  children,
}: {
  trigger: number
  active: boolean
  style?: StyleProp<ViewStyle>
  children: React.ReactNode
}) {
  const reduceMotion = useReducedMotion()
  const x = useSharedValue(0)
  const scale = useSharedValue(1)

  useEffect(() => {
    if (trigger === 0 || !active || reduceMotion) return
    x.value = withSequence(
      withTiming(-7, { duration: 55 }),
      withTiming(7, { duration: 90 }),
      withTiming(-4, { duration: 80 }),
      withTiming(0, { duration: 70 }),
    )
    scale.value = withSequence(withTiming(1.05, { duration: 110 }), withSpring(1, { damping: 12, stiffness: 220 }))
    // Fires per nudge only; `active` is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { scale: scale.value }],
  }))

  return <Reanimated.View style={[style, animStyle]}>{children}</Reanimated.View>
}
