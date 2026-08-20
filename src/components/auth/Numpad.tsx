import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const

export function Numpad({
  onDigit,
  onBackspace,
  disabled = false,
}: {
  onDigit: (digit: string) => void
  onBackspace: () => void
  disabled?: boolean
}) {
  const { tokens } = useTheme()
  return (
    <View style={styles.grid}>
      {KEYS.map((k, i) => {
        if (k === '') return <View key={i} style={styles.key} />
        return (
          <Pressable
            key={i}
            disabled={disabled}
            onPress={() => (k === 'del' ? onBackspace() : onDigit(k))}
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
