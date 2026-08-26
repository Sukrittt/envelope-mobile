import { Pressable, Text, StyleSheet, type ViewStyle, type StyleProp } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import type { LucideIcon } from 'lucide-react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { Icon } from '@/src/components/shared/Icon'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

/** Shared press spring so every tappable in the app compresses identically. */
function usePressSpring(scaleTo = 0.96) {
  const { motion } = useTheme()
  const scale = useSharedValue(1)
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return {
    style,
    onPressIn: () => {
      scale.value = withSpring(scaleTo, motion.spring)
    },
    onPressOut: () => {
      scale.value = withSpring(1, motion.spring)
    },
  }
}

type Variant = 'primary' | 'secondary' | 'ghost'

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  style,
}: {
  label: string
  onPress: () => void
  variant?: Variant
  icon?: LucideIcon
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const { tokens, radius, space, type } = useTheme()
  const press = usePressSpring()

  // `accentInk` rather than `accent` for the primary fill: it is the variant that
  // clears 4.5:1 against a small onAccent label.
  const bg =
    variant === 'primary' ? tokens.accentInk : variant === 'secondary' ? tokens.pillBg : 'transparent'
  const fg = variant === 'primary' ? tokens.onAccent : tokens.text
  const border = variant === 'secondary' ? tokens.border : 'transparent'

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
        onPress()
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[
        styles.button,
        {
          backgroundColor: bg,
          borderColor: border,
          borderRadius: radius.full,
          paddingVertical: space.md + 2,
          paddingHorizontal: space.xl,
          gap: space.sm,
          opacity: disabled ? 0.45 : 1,
        },
        press.style,
        style,
      ]}
    >
      {icon ? <Icon icon={icon} size={18} color={fg} /> : null}
      <Text style={{ color: fg, fontFamily: fontFamily.bodyBold, fontSize: type.bodyLg }}>{label}</Text>
    </AnimatedPressable>
  )
}

/** Circular icon button — the header action affordance, and the nav's building block. */
export function IconButton({
  icon,
  onPress,
  size = 40,
  color,
  background,
  accessibilityLabel,
  style,
}: {
  icon: LucideIcon
  onPress: () => void
  size?: number
  color?: string
  background?: string
  accessibilityLabel: string
  style?: StyleProp<ViewStyle>
}) {
  const { tokens } = useTheme()
  const press = usePressSpring(0.9)

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
        onPress()
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[
        styles.icon,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background ?? tokens.cardSolid,
        },
        press.style,
        style,
      ]}
    >
      <Icon icon={icon} size={Math.round(size * 0.45)} color={color ?? tokens.text} />
    </AnimatedPressable>
  )
}

export { usePressSpring }

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  icon: { alignItems: 'center', justifyContent: 'center' },
})
