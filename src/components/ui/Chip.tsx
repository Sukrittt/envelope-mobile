import { Pressable, Text, StyleSheet, type ViewStyle, type StyleProp } from 'react-native'
import Animated from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { usePressSpring } from './Button'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

/**
 * Selectable pill. Covers the category rail, holding-type picker, billing-cycle
 * picker and the Activity period toggle — all of which hand-rolled the same shape.
 *
 * `onAccent` renders the chip for the flood screen, where the ground is `accent`
 * and the usual card/border colors would disappear into it.
 */
export function Chip({
  label,
  selected,
  onPress,
  onAccent,
  style,
}: {
  label: string
  selected?: boolean
  onPress: () => void
  onAccent?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const { tokens, radius, space, type } = useTheme()
  const press = usePressSpring(0.94)

  const bg = onAccent
    ? selected
      ? tokens.onAccent
      : 'rgba(255, 255, 255, 0.18)'
    : selected
      ? tokens.accentInk
      : tokens.pillBg
  const fg = onAccent ? (selected ? tokens.accentInk : tokens.onAccent) : selected ? tokens.onAccent : tokens.text2
  const border = onAccent ? 'transparent' : selected ? tokens.accentInk : tokens.border

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {})
        onPress()
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[
        styles.chip,
        {
          backgroundColor: bg,
          borderColor: border,
          borderRadius: radius.full,
          paddingVertical: space.sm,
          paddingHorizontal: space.lg,
        },
        press.style,
        style,
      ]}
    >
      <Text style={{ color: fg, fontFamily: fontFamily.bodySemiBold, fontSize: type.caption }}>{label}</Text>
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
})
