import { View, Text, Pressable, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import { ChevronLeft } from 'lucide-react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'

const BASE_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'del'] as const

/**
 * Custom numeric keypad. Shared by the code screen, the setup wizard and the
 * log-expense screen — a keypad on-screen instead of the OS keyboard is what
 * keeps amount entry to one thumb and no keyboard pop.
 *
 * `onAccent` renders it for the log screen's accent ground, where the usual
 * card/border colors would vanish.
 */
export function Numpad({
  onDigit,
  onBackspace,
  onClear,
  disabled = false,
  extraKey,
  onAccent = false,
}: {
  onDigit: (digit: string) => void
  onBackspace: () => void
  /** Long-pressing the delete key clears the whole field. Omit to disable. */
  onClear?: () => void
  disabled?: boolean
  /** Fills the blank slot before '0' (e.g. '00' for an amount pad). Omit for a blank slot. */
  extraKey?: string
  onAccent?: boolean
}) {
  const { tokens, radius, space } = useTheme()
  const keys = [...BASE_KEYS.slice(0, 9), extraKey ?? '', ...BASE_KEYS.slice(9)]

  const keyBg = onAccent ? 'transparent' : tokens.card
  const keyBorder = onAccent ? 'transparent' : tokens.border
  // Log-expense's accent flood stays the same saturated orange in both
  // schemes, so its keys stay white in both too — tokens.onAccent flips to
  // near-black in dark mode for normal accent surfaces, which is wrong here.
  const keyColor = onAccent ? '#ffffff' : tokens.text

  return (
    <View style={[styles.grid, { gap: space.md - 2 }]}>
      {keys.map((k, i) => {
        if (k === '') return <View key={i} style={[styles.key, { borderWidth: 0 }]} />
        return (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={k === 'del' ? 'Delete' : k}
            disabled={disabled}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
              if (k === 'del') onBackspace()
              else onDigit(k)
            }}
            onLongPress={
              k === 'del' && onClear
                ? () => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
                    onClear()
                  }
                : undefined
            }
            style={({ pressed }) => [
              styles.key,
              {
                backgroundColor: keyBg,
                borderColor: keyBorder,
                borderRadius: radius.lg,
                opacity: disabled ? 0.5 : pressed ? 0.6 : 1,
              },
            ]}
          >
            {k === 'del' ? (
              <ChevronLeft size={22} color={keyColor} />
            ) : (
              <Text style={[styles.label, { color: keyColor, fontFamily: fontFamily.displaySemiBold }]}>{k}</Text>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  key: { width: '31.3%', minHeight: 56, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 22 },
})
