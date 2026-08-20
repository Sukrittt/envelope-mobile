import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'

export function CodeBoxes({ code, length = 6 }: { code: string; length?: number }) {
  const { tokens } = useTheme()
  return (
    <View style={styles.row}>
      {Array.from({ length }, (_, i) => {
        const char = code[i] || ''
        const active = i === code.length
        const borderColor = active ? tokens.gold : char ? tokens.borderStrong : tokens.border
        return (
          <View
            key={i}
            style={[styles.box, { backgroundColor: tokens.inputBg, borderColor }]}
          >
            <Text style={[styles.char, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>{char}</Text>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  box: { flex: 1, aspectRatio: 1 / 1.2, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1.5 },
  char: { fontSize: 24 },
})
