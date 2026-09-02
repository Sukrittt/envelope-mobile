import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { formatCurrency } from '@/src/lib/format'
import { TourRow } from '@/src/components/tour/parts'
import { QUIZ_OPTIONS, QUIZ_QUESTION, ROLLOVER_ROWS } from '@/src/components/tour/content'

/**
 * Chapter 4: the quiz, then a September 30 / October 1 toggle showing what a
 * new month actually does. Mirrors src/lib/envelope.ts: the assigned amount
 * carries as a template, the leftover does not, and Credit Card Payment
 * restarts at zero.
 */
export function RolloverDemo({ onComplete }: { onComplete: () => void }) {
  const { tokens, radius, space, type } = useTheme()
  const [answer, setAnswer] = useState<string | null>(null)
  const [month, setMonth] = useState<'sep' | 'oct'>('sep')

  const picked = QUIZ_OPTIONS.find((option) => option.id === answer)
  const isOctober = month === 'oct'

  return (
    <View style={{ gap: space.md }}>
      <View
        style={[
          styles.quiz,
          { backgroundColor: tokens.cardSolid, borderColor: tokens.accent, borderRadius: radius.lg, padding: space.lg, gap: space.md },
        ]}
      >
        <Text style={[styles.kicker, { color: tokens.accentInk, fontFamily: fontFamily.bodyBold, fontSize: type.micro }]}>
          POP QUIZ
        </Text>
        <Text style={{ color: tokens.text, fontFamily: fontFamily.displaySemiBold, fontSize: type.bodyLg, lineHeight: 24 }}>
          {QUIZ_QUESTION}
        </Text>
        {QUIZ_OPTIONS.map((option) => {
          const revealed = answer != null
          const good = revealed && option.correct
          const bad = answer === option.id && !option.correct
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              onPress={() => {
                setAnswer(option.id)
                if (option.correct) onComplete()
              }}
              style={[
                styles.option,
                {
                  backgroundColor: good ? tokens.mintSoft : bad ? tokens.coralSoft : tokens.inputBg,
                  borderColor: good ? tokens.mint : bad ? tokens.coral : tokens.border,
                  borderRadius: radius.md,
                  padding: space.md,
                  gap: space.sm,
                },
              ]}
            >
              <View
                style={[
                  styles.dot,
                  { borderColor: good ? tokens.mint : bad ? tokens.coral : tokens.borderStrong },
                ]}
              >
                <Text style={{ color: good ? tokens.mint : tokens.coral, fontFamily: fontFamily.bodyBold, fontSize: 11 }}>
                  {good ? '✓' : bad ? '✕' : ''}
                </Text>
              </View>
              <Text style={{ flex: 1, color: tokens.text, fontFamily: fontFamily.bodyBold, fontSize: type.caption, lineHeight: 19 }}>
                {option.label}
              </Text>
            </Pressable>
          )
        })}
        {picked && (
          <Text
            style={{
              color: picked.correct ? tokens.mint : tokens.warnInk,
              fontFamily: fontFamily.bodyBold,
              fontSize: type.caption,
              lineHeight: 20,
            }}
          >
            {picked.feedback}
          </Text>
        )}
      </View>

      <View style={[styles.tabs, { backgroundColor: tokens.inputBg, borderColor: tokens.border, borderRadius: radius.md, padding: 5, gap: 6 }]}>
        {([
          { key: 'sep', label: 'September 30' },
          { key: 'oct', label: 'October 1' },
        ] as const).map((tab) => {
          const active = month === tab.key
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                setMonth(tab.key)
                if (tab.key === 'oct') onComplete()
              }}
              style={[
                styles.tab,
                { backgroundColor: active ? tokens.accentInk : 'transparent', borderRadius: radius.sm },
              ]}
            >
              <Text
                style={{
                  color: active ? tokens.onAccent : tokens.text2,
                  fontFamily: fontFamily.bodyBold,
                  fontSize: type.caption,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {ROLLOVER_ROWS.map((row) => (
        <TourRow
          key={row.name}
          emoji={row.emoji}
          name={row.name}
          note={
            isOctober
              ? row.creditCard
                ? "restarts at zero · it was last month's bill"
                : 'plan carried from September'
              : row.left > 0
                ? `${formatCurrency(row.left)} still unspent`
                : 'fully spent'
          }
          noteColor={isOctober && row.creditCard ? tokens.warnInk : undefined}
          right={
            <View style={styles.right}>
              <Text style={{ color: tokens.text, fontFamily: fontFamily.bodySemiBold, fontSize: type.body }}>
                {isOctober && row.creditCard ? formatCurrency(0) : formatCurrency(row.plan)}
              </Text>
              <Text
                style={[
                  styles.kicker,
                  {
                    color: isOctober && row.left > 0 && !row.creditCard ? tokens.coral : tokens.text3,
                    fontFamily: fontFamily.bodyBold,
                    fontSize: type.micro - 2,
                  },
                ]}
              >
                {isOctober ? (row.left > 0 && !row.creditCard ? 'LEFTOVER GONE' : 'FRESH START') : 'ASSIGNED'}
              </Text>
            </View>
          }
        />
      ))}

      <Text style={{ color: tokens.text2, fontFamily: fontFamily.bodySemiBold, fontSize: type.micro, lineHeight: 19, paddingHorizontal: 4 }}>
        {isOctober
          ? 'Two exceptions: Credit Card Payment always restarts at 0, and nothing needs triggering by hand. The new month simply is.'
          : 'On the 1st, Home shows a one time note of what you left unspent. The permanent record lives in Insights.'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  quiz: { borderWidth: 1 },
  option: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', borderWidth: 1 },
  tab: { flex: 1, height: 38, alignItems: 'center', justifyContent: 'center' },
  right: { alignItems: 'flex-end', gap: 2 },
  kicker: { letterSpacing: 1 },
})
