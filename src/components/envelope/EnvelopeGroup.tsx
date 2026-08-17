import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { formatCurrency } from '@/src/lib/format'
import { groupEmoji, categoryEmoji, splitEmoji } from '@/src/lib/emoji'
import { EnvelopeRow } from './EnvelopeRow'
import type { Envelope } from '@/src/lib/envelope'

interface Props {
  group: string
  envelopes: Envelope[]
  hideAmounts: boolean
  onMoveMoney: (category: string) => void
  onEditAmount: (category: string, newAssigned: number) => Promise<void>
  onViewTransactions: (category: string) => void
  expanded: boolean
  onToggle: (group: string) => void
}

/** Expandable group header + its category rows, matching the dc.html "Envelopes" panel. */
export function EnvelopeGroup({
  group,
  envelopes,
  hideAmounts,
  onMoveMoney,
  onEditAmount,
  onViewTransactions,
  expanded,
  onToggle,
}: Props) {
  const { tokens } = useTheme()
  const totalAvailable = envelopes.reduce((s, e) => s + e.available, 0)

  return (
    <View style={[styles.wrap, { borderTopColor: tokens.border }]}>
      <Pressable style={styles.header} onPress={() => onToggle(group)}>
        <View style={styles.headerLeft}>
          <Text style={[styles.chevron, { color: tokens.text2 }, expanded && styles.chevronOpen]}>▸</Text>
          <Text style={{ fontSize: 14 }}>{groupEmoji(group)}</Text>
          <Text style={[styles.name, { color: tokens.text, fontFamily: fontFamily.bodyExtraBold }]}>
            {splitEmoji(group).text}
          </Text>
        </View>
        <Text style={[styles.available, { color: tokens.mint, fontFamily: fontFamily.bodySemiBold }]}>
          {formatCurrency(totalAvailable, hideAmounts)} left
        </Text>
      </Pressable>
      {expanded && (
        <View style={[styles.rows, { borderLeftColor: tokens.border }]}>
          {envelopes.map((e, i) => (
            <View key={e.category} style={i > 0 && [styles.rowDivider, { borderTopColor: tokens.border }]}>
              <EnvelopeRow
                envelope={e}
                emoji={categoryEmoji(e.category, group)}
                hideAmounts={hideAmounts}
                onMoveMoney={onMoveMoney}
                onEditAmount={onEditAmount}
                onViewTransactions={onViewTransactions}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: 1, paddingTop: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chevron: { fontSize: 12 },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  name: { fontSize: 13 },
  available: { fontSize: 12 },
  rows: { paddingLeft: 12, marginLeft: 6, borderLeftWidth: StyleSheet.hairlineWidth },
  // Pulled back to x=0 (rows' own left border) then repadded, so the horizontal
  // line meets the vertical group line instead of starting after paddingLeft.
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 2, marginLeft: -12, paddingLeft: 12 },
})
