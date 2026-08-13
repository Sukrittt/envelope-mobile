import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'

/** Placeholder for screens not yet built by their owning package (B/C/D/E). */
export function StubScreen({ title }: { title: string }) {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.container, { backgroundColor: tokens.bg, paddingTop: insets.top + 24 }]}>
      <Text style={[styles.title, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>Coming soon</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 22 },
  subtitle: { fontSize: 13 },
})
