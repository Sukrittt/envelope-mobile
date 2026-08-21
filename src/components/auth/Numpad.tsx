import { View, Text, Pressable, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useAudioPlayer } from 'expo-audio'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'

const BASE_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'del'] as const

export function Numpad({
  onDigit,
  onBackspace,
  disabled = false,
  extraKey,
  playTapSound = false,
}: {
  onDigit: (digit: string) => void
  onBackspace: () => void
  disabled?: boolean
  /** Fills the blank slot before '0' (e.g. '00' for an amount pad). Omit for a blank slot. */
  extraKey?: string
  /** Plays a tap tone on digit presses (not backspace). Off by default — only the OTP code screen opts in. */
  playTapSound?: boolean
}) {
  const { tokens } = useTheme()
  // ponytail: tap.mp3 is a silent 150ms placeholder — swap the file for a real
  // effect (same filename/path) once one is provided, no code change needed.
  const tapSound = useAudioPlayer(require('@/assets/sounds/tap.mp3'))
  const keys = [...BASE_KEYS.slice(0, 9), extraKey ?? '', ...BASE_KEYS.slice(9)]
  return (
    <View style={styles.grid}>
      {keys.map((k, i) => {
        if (k === '') return <View key={i} style={[styles.key, { borderWidth: 0 }]} />
        return (
          <Pressable
            key={i}
            disabled={disabled}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
              if (k === 'del') {
                onBackspace()
              } else {
                if (playTapSound) {
                  tapSound.seekTo(0)
                  tapSound.play()
                }
                onDigit(k)
              }
            }}
            style={[styles.key, { backgroundColor: tokens.card, borderColor: tokens.border, opacity: disabled ? 0.5 : 1 }]}
          >
            <Text style={[k === 'del' ? styles.delLabel : styles.label, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
              {k === 'del' ? '⌫' : k}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  key: { width: '31.3%', minHeight: 56, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 22 },
  delLabel: { fontSize: 18 },
})
