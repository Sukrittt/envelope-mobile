import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { formatCurrency } from '@/src/lib/format'
import { SectionLabel, ResultCard } from '@/src/components/tour/parts'
import { MOVE_AMOUNT, MOVE_IN_ENVELOPE, MOVE_NEED, MOVE_SOURCES } from '@/src/components/tour/content'

/** Chapter 3: cover a shortfall by borrowing from an envelope with slack. */
export function MoveDemo({ onComplete }: { onComplete: () => void }) {
  const { tokens, radius, space, type } = useTheme()
  const [moved, setMoved] = useState<{ id: string; name: string; amount: number } | null>(null)

  const inEnvelope = MOVE_IN_ENVELOPE + (moved?.amount ?? 0)
  const short = Math.max(0, MOVE_NEED - inEnvelope)

  return (
    <View style={{ gap: space.md }}>
      <View
        style={[
          styles.dest,
          {
            backgroundColor: tokens.cardSolid,
            borderColor: tokens.border,
            borderRadius: radius.lg,
            padding: space.md,
            gap: space.md,
          },
        ]}
      >
        <View style={[styles.tile, { backgroundColor: tokens.accentSoft, borderRadius: radius.md }]}>
          <Text style={{ fontSize: 20 }}>💡</Text>
        </View>
        <View style={styles.body}>
          <Text style={[styles.kicker, { color: tokens.text2, fontFamily: fontFamily.bodyBold, fontSize: type.micro }]}>
            ELECTRICITY · {formatCurrency(MOVE_NEED)} DUE THE 5TH
          </Text>
          <Text style={{ color: tokens.text, fontFamily: fontFamily.displaySemiBold, fontSize: type.bodyLg }}>
            {formatCurrency(inEnvelope)} in the envelope
          </Text>
          <Text
            style={{
              color: short > 0 ? tokens.coral : tokens.mint,
              fontFamily: fontFamily.bodyBold,
              fontSize: type.micro,
            }}
          >
            {short > 0 ? `${formatCurrency(short)} short` : 'fully funded ✓'}
          </Text>
        </View>
      </View>

      <SectionLabel>{short > 0 ? 'BEST PLACES TO BORROW FROM' : 'WHERE IT CAME FROM'}</SectionLabel>

      {MOVE_SOURCES.map((source) => {
        const taken = moved?.id === source.id ? moved.amount : 0
        const isProtected = 'protected' in source && source.protected
        return (
          <Pressable
            key={source.id}
            accessibilityRole="button"
            onPress={() => {
              setMoved({ id: source.id, name: source.name, amount: Math.min(MOVE_AMOUNT, source.available) })
              onComplete()
            }}
            style={[
              styles.source,
              {
                backgroundColor: taken ? tokens.accentSoft : tokens.cardSolid,
                borderColor: taken ? tokens.accent : isProtected ? tokens.warn : tokens.border,
                borderRadius: radius.md,
                padding: space.md,
                gap: space.md,
              },
            ]}
          >
            <View style={[styles.tileSm, { backgroundColor: tokens.inputBg, borderRadius: radius.sm }]}>
              <Text style={{ fontSize: 16 }}>{source.emoji}</Text>
            </View>
            <View style={styles.body}>
              <Text style={{ color: tokens.text, fontFamily: fontFamily.bodyBold, fontSize: type.body }}>{source.name}</Text>
              <Text
                style={{
                  color: taken ? tokens.accentInk : isProtected ? tokens.warnInk : tokens.text3,
                  fontFamily: fontFamily.bodySemiBold,
                  fontSize: type.micro,
                }}
              >
                {taken ? `Gave ${formatCurrency(taken)} · still fine for the month` : source.note}
              </Text>
            </View>
            <View style={styles.right}>
              <Text style={{ color: tokens.text, fontFamily: fontFamily.bodySemiBold, fontSize: type.body }}>
                {formatCurrency(source.available - taken)}
              </Text>
              <Text style={[styles.kicker, { color: tokens.text3, fontFamily: fontFamily.bodyBold, fontSize: type.micro - 2 }]}>
                AVAILABLE
              </Text>
            </View>
          </Pressable>
        )
      })}

      {moved && (
        <ResultCard tone="mint">
          <Text style={{ color: tokens.mint, fontFamily: fontFamily.displaySemiBold, fontSize: type.bodyLg }}>
            {formatCurrency(moved.amount)} moved from {moved.name}
          </Text>
          <Text style={{ color: tokens.text2, fontFamily: fontFamily.bodySemiBold, fontSize: type.micro, lineHeight: 18 }}>
            Not a single rupee left your bank. Only the plan changed, and that is the whole trick.
          </Text>
          <Pressable accessibilityRole="button" onPress={() => setMoved(null)} hitSlop={8}>
            <Text style={{ color: tokens.text2, fontFamily: fontFamily.bodyBold, fontSize: type.caption }}>Undo</Text>
          </Pressable>
        </ResultCard>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  dest: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  source: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  tile: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  tileSm: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, gap: 2 },
  right: { alignItems: 'flex-end', gap: 2 },
  kicker: { letterSpacing: 1 },
})
