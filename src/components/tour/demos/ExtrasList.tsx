import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { EXTRAS } from '@/src/components/tour/content'

/** Chapter 6: the rest of the app, one accordion row each. */
export function ExtrasList({ onComplete }: { onComplete: () => void }) {
  const { tokens, radius, space, type } = useTheme()
  const [open, setOpen] = useState<Record<number, boolean>>({})

  function toggle(index: number) {
    const next = { ...open }
    if (next[index]) delete next[index]
    else next[index] = true
    setOpen(next)
    if (Object.keys(next).length >= 2) onComplete()
  }

  return (
    <View style={{ gap: space.sm }}>
      {EXTRAS.map((extra, index) => {
        const isOpen = !!open[index]
        return (
          <Pressable
            key={extra.name}
            accessibilityRole="button"
            accessibilityState={{ expanded: isOpen }}
            onPress={() => toggle(index)}
            style={[
              styles.row,
              {
                backgroundColor: isOpen ? tokens.accentSoft : tokens.cardSolid,
                borderColor: isOpen ? tokens.accent : tokens.border,
                borderRadius: radius.md,
                padding: space.md,
                gap: space.sm,
              },
            ]}
          >
            <View style={[styles.head, { gap: space.md }]}>
              <View style={[styles.tile, { backgroundColor: tokens.inputBg, borderRadius: radius.sm }]}>
                <Text style={{ fontSize: 16 }}>{extra.emoji}</Text>
              </View>
              <Text style={{ flex: 1, color: tokens.text, fontFamily: fontFamily.displaySemiBold, fontSize: type.body }}>
                {extra.name}
              </Text>
              <Text style={{ color: isOpen ? tokens.accentInk : tokens.text3, fontFamily: fontFamily.bodyBold, fontSize: type.body }}>
                {isOpen ? '−' : '+'}
              </Text>
            </View>
            {isOpen && (
              <Text style={{ color: tokens.text2, fontFamily: fontFamily.bodySemiBold, fontSize: type.micro, lineHeight: 19 }}>
                {extra.desc}
              </Text>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { borderWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'center' },
  tile: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
})
