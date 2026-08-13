import { useState } from 'react'
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
  defaultExpanded?: boolean
}

/** Expandable group header + its category rows, matching the dc.html "Envelopes" panel. */
export function EnvelopeGroup({
  group,
  envelopes,
  hideAmounts,
  onMoveMoney,
  onEditAmount,
  defaultExpanded = true,
}: Props) {
  const { tokens } = useTheme()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const totalAvailable = envelopes.reduce((s, e) => s + e.available, 0)

  return (
    <View style={[styles.wrap, { borderTopColor: tokens.border }]}>
      <Pressable style={styles.header} onPress={() => setExpanded((v) => !v)}>
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
        <View style={styles.rows}>
          {envelopes.map((e) => (
            <EnvelopeRow
              key={e.category}
              envelope={e}
              emoji={categoryEmoji(e.category, group)}
              hideAmounts={hideAmounts}
              onMoveMoney={onMoveMoney}
              onEditAmount={onEditAmount}
            />
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
  rows: { paddingLeft: 4 },
})
