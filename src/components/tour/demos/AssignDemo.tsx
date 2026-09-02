import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { formatCurrency } from '@/src/lib/format'
import { AmountText } from '@/src/components/ui/AmountText'
import { TourRow } from '@/src/components/tour/parts'
import { ASSIGN_ROWS, TOUR_INCOME } from '@/src/components/tour/content'

/** Chapter 1: hand out the income until Ready to Assign hits zero. */
export function AssignDemo({ onComplete }: { onComplete: () => void }) {
  const { tokens, radius, space, type } = useTheme()
  const [funded, setFunded] = useState<Record<string, boolean>>({})

  const assigned = ASSIGN_ROWS.reduce((sum, row) => sum + (funded[row.id] ? row.plan : 0), 0)
  const readyToAssign = TOUR_INCOME - assigned

  function toggle(id: string) {
    const next = { ...funded }
    if (next[id]) delete next[id]
    else next[id] = true
    setFunded(next)
    const left = TOUR_INCOME - ASSIGN_ROWS.reduce((sum, row) => sum + (next[row.id] ? row.plan : 0), 0)
    if (left === 0) onComplete()
  }

  const heroColor = readyToAssign === 0 ? tokens.mint : readyToAssign < 0 ? tokens.coral : tokens.text
  const note =
    readyToAssign === 0
      ? 'Every rupee has a job ✓'
      : readyToAssign < 0
        ? 'You have assigned more than you earn'
        : `${formatCurrency(readyToAssign)} of your ${formatCurrency(TOUR_INCOME)} income has no job yet`

  return (
    <View style={{ gap: space.md }}>
      <View
        style={[
          styles.hero,
          { backgroundColor: tokens.cardSolid, borderColor: tokens.border, borderRadius: radius.lg, padding: space.lg },
        ]}
      >
        <Text style={[styles.heroLabel, { color: tokens.text2, fontFamily: fontFamily.bodyBold, fontSize: type.micro }]}>
          READY TO ASSIGN
        </Text>
        <AmountText value={readyToAssign} size={type.display} color={heroColor} weight="displayBold" animate ignoreHide id="tour-rta" />
        <Text
          style={[
            styles.heroNote,
            {
              color: readyToAssign === 0 ? tokens.mint : readyToAssign < 0 ? tokens.coral : tokens.text2,
              fontFamily: fontFamily.bodySemiBold,
              fontSize: type.caption,
            },
          ]}
        >
          {note}
        </Text>
      </View>

      {ASSIGN_ROWS.map((row) => {
        const on = !!funded[row.id]
        return (
          <TourRow
            key={row.id}
            emoji={row.emoji}
            name={row.name}
            note={on ? `${formatCurrency(row.plan)} funded` : `needs ${formatCurrency(row.plan)}`}
            noteColor={on ? tokens.mint : undefined}
            right={
              <Pressable
                accessibilityRole="button"
                onPress={() => toggle(row.id)}
                style={[
                  styles.pill,
                  {
                    borderRadius: radius.full,
                    paddingHorizontal: space.md,
                    backgroundColor: on ? tokens.mintSoft : tokens.pillBg,
                    borderColor: on ? tokens.mint : tokens.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: on ? tokens.mint : tokens.text,
                    fontFamily: fontFamily.bodyBold,
                    fontSize: type.micro,
                  }}
                >
                  {on ? '✓ Funded' : `Assign ${formatCurrency(row.plan)}`}
                </Text>
              </Pressable>
            }
          />
        )
      })}

      <Pressable accessibilityRole="button" onPress={() => setFunded({})} style={styles.reset} hitSlop={8}>
        <Text style={{ color: tokens.text3, fontFamily: fontFamily.bodyBold, fontSize: type.caption }}>Start over</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 4, borderWidth: 1 },
  heroLabel: { letterSpacing: 1 },
  heroNote: { textAlign: 'center' },
  pill: { height: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  reset: { alignSelf: 'center', padding: 4 },
})
