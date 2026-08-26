import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'

// SetupWizard.dc.html:301-304 — the group/category row: emoji cycle button,
// name input, on/off toggle. Shared by the groups and categories steps.
export function PickRow({
  emoji,
  name,
  on,
  placeholder,
  onCycleEmoji,
  onChangeName,
  onToggle,
}: {
  emoji: string
  name: string
  on: boolean
  placeholder: string
  onCycleEmoji: () => void
  onChangeName: (name: string) => void
  onToggle: () => void
}) {
  const { tokens } = useTheme()
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: on ? tokens.card : 'transparent', borderColor: on ? tokens.accent : tokens.border },
      ]}
    >
      <Pressable
        onPress={onCycleEmoji}
        style={[styles.emojiBtn, { backgroundColor: tokens.inputBg, borderColor: tokens.border, opacity: on ? 1 : 0.55 }]}
      >
        <Text style={styles.emojiLabel}>{emoji}</Text>
      </Pressable>
      <TextInput
        value={name}
        onChangeText={onChangeName}
        placeholder={placeholder}
        placeholderTextColor={tokens.text3}
        style={[styles.nameInput, { color: on ? tokens.text : tokens.text3, fontFamily: fontFamily.bodyBold }]}
      />
      <Pressable
        onPress={onToggle}
        style={[
          styles.check,
          { borderColor: on ? tokens.accent : tokens.borderStrong, backgroundColor: on ? tokens.accent : 'transparent' },
        ]}
      >
        {on && <Text style={[styles.checkLabel, { color: tokens.onAccent }]}>✓</Text>}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, paddingHorizontal: 13, borderRadius: 18, borderWidth: 1.5 },
  emojiBtn: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emojiLabel: { fontSize: 17 },
  nameInput: { flex: 1, fontSize: 14, paddingVertical: 6, paddingHorizontal: 2 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkLabel: { fontSize: 13, lineHeight: 15 },
})
