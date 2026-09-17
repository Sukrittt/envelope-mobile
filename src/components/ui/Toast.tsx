import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Reanimated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import type { LucideIcon } from 'lucide-react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'

const VISIBLE_MS = 2600
// Bouncier than motion.spring: the drop-in should land with a little overshoot.
const DROP_SPRING = { mass: 0.8, damping: 13, stiffness: 190 }

/**
 * A pill that drops in from the top, squashes a little as it lands, and floats
 * back up after VISIBLE_MS. Bump `trigger` to show it; bumping again while it's
 * up wiggles it and restarts the timer instead of re-entering. An empty
 * `message` hides it early (e.g. the user fixed what it was nagging about).
 */
export function Toast({
  message,
  trigger,
  icon: Icon,
  style,
}: {
  message: string
  trigger: number
  icon?: LucideIcon
  style?: StyleProp<ViewStyle>
}) {
  const { tokens, space, radius, type, elevation } = useTheme()
  const reduceMotion = useReducedMotion()
  const [shown, setShown] = useState(false)
  const [seenTrigger, setSeenTrigger] = useState(trigger)
  // Last non-empty copy, so the exit animation doesn't flash an empty pill.
  const [text, setText] = useState(message)
  if (message && message !== text) setText(message)
  if (trigger !== seenTrigger) {
    setSeenTrigger(trigger)
    if (trigger > 0 && message) setShown(true)
  }
  if (!message && shown) setShown(false)

  // Whether the pill was already up when this trigger landed (wiggle vs drop-in).
  const upRef = useRef(false)
  const progress = useSharedValue(0)
  const wiggle = useSharedValue(0)
  const bump = useSharedValue(1)

  useEffect(() => {
    if (!shown) {
      upRef.current = false
      progress.value = withTiming(0, { duration: 220 })
      return
    }
    if (!upRef.current) {
      upRef.current = true
      progress.value = reduceMotion ? withTiming(1, { duration: 160 }) : withSpring(1, DROP_SPRING)
    } else if (!reduceMotion) {
      wiggle.value = withSequence(
        withTiming(-1, { duration: 50 }),
        withTiming(1, { duration: 90 }),
        withTiming(-0.5, { duration: 80 }),
        withTiming(0, { duration: 60 }),
      )
      bump.value = withSequence(withTiming(1.06, { duration: 90 }), withSpring(1, DROP_SPRING))
    }
    const timer = setTimeout(() => setShown(false), VISIBLE_MS)
    return () => clearTimeout(timer)
    // Re-runs per trigger so a repeat tap wiggles and restarts the timer.
  }, [shown, trigger, reduceMotion, progress, wiggle, bump])

  const animStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value * 1.5),
    transform: [
      { translateY: (1 - progress.value) * -28 },
      { scale: (0.86 + progress.value * 0.14) * bump.value },
      { rotate: `${wiggle.value * 3}deg` },
    ],
  }))

  return (
    <Reanimated.View pointerEvents="none" style={[styles.wrap, style, animStyle]}>
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityElementsHidden={!shown}
        importantForAccessibility={shown ? 'yes' : 'no-hide-descendants'}
        style={[
          styles.pill,
          elevation.floating,
          {
            backgroundColor: tokens.cardSolid,
            borderRadius: radius.full,
            paddingLeft: Icon ? space.xs + 2 : space.lg,
            paddingRight: space.lg,
            gap: space.sm,
          },
        ]}
      >
        {Icon ? (
          <View style={[styles.badge, { backgroundColor: tokens.accent }]}>
            <Icon size={15} color="#ffffff" strokeWidth={2.5} />
          </View>
        ) : null}
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
          style={{ flexShrink: 1, color: tokens.text, fontFamily: fontFamily.bodyBold, fontSize: type.body }}
        >
          {text}
        </Text>
      </View>
    </Reanimated.View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  pill: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, minHeight: 44, maxWidth: '86%' },
  badge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
})
