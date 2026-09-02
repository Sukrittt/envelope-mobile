import { useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { usePrivacy } from '@/src/context/PrivacyContext'
import { fontFamily } from '@/src/theme/fonts'
import { formatCurrency } from '@/src/lib/format'
import { CHART_COLOR_CYCLE } from '@/src/theme/chartColors'
import { ProgressBar } from '@/src/components/envelope/ProgressBar'
import { DonutChart } from './DonutChart'
import type { BreakdownRow } from '@/src/lib/monthly'

interface Props {
  rows: BreakdownRow[]
  totalSpent: number
  totalDeltaPct: number | null
  mode: 'category' | 'group'
  onModeChange: (mode: 'category' | 'group') => void
  leftover: number
  monthLabel: string
}

const VISIBLE_ROWS = 6

/** Mirrors EnvelopeRow's usedPctLabel: spend as % of assigned, ∞ if spending with nothing assigned. */
function usedPctLabel(row: BreakdownRow): string {
  if (row.assigned > 0) return `${Math.round((row.spent / row.assigned) * 100)}%`
  return row.spent > 0 ? '∞' : '—'
}

export function CategoryBreakdown({ rows, totalSpent, totalDeltaPct, mode, onModeChange, leftover, monthLabel }: Props) {
  const { tokens, space, radius, type } = useTheme()
  const { hideAmounts } = usePrivacy()
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  // Reset the selected slice when the underlying rows change (new month or mode)
  // rather than pointing at a row that no longer exists.
  const rowKeys = rows.map((r) => r.key).join('|')
  const prevRowKeys = useRef(rowKeys)
  if (prevRowKeys.current !== rowKeys) {
    prevRowKeys.current = rowKeys
    if (selectedKey != null) setSelectedKey(null)
  }

  const segments = useMemo(
    () =>
      rows.map((row, i) => ({
        key: row.key,
        label: row.label,
        emoji: row.emoji,
        value: row.spent,
        color: tokens[CHART_COLOR_CYCLE[i % CHART_COLOR_CYCLE.length]],
      })),
    [rows, tokens],
  )

  const selectedRow = rows.find((r) => r.key === selectedKey) ?? null
  const visibleRows = expanded ? rows : rows.slice(0, VISIBLE_ROWS)
  const hiddenCount = rows.length - VISIBLE_ROWS

  return (
    <View>
      <View style={styles.headRow}>
        <View>
          <Text style={{ color: tokens.text2, fontSize: type.caption, fontFamily: fontFamily.bodyMedium }}>
            Total spent
          </Text>
          <View style={styles.totalRow}>
            <Text style={{ color: tokens.text, fontSize: type.bodyLg, fontFamily: fontFamily.displayBold }}>
              {formatCurrency(totalSpent, hideAmounts)}
            </Text>
            {totalDeltaPct != null && (
              <Text
                style={{
                  color: totalDeltaPct > 0 ? tokens.coral : tokens.mint,
                  fontSize: type.caption,
                  fontFamily: fontFamily.bodySemiBold,
                }}
              >
                {totalDeltaPct > 0 ? '▲' : '▼'} {Math.abs(totalDeltaPct).toFixed(1)}%
              </Text>
            )}
          </View>
        </View>
        <View style={[styles.toggleGroup, { backgroundColor: tokens.inputBg, borderRadius: radius.full }]}>
          <Pressable
            accessibilityLabel="By category"
            onPress={() => onModeChange('category')}
            style={[styles.toggleBtn, { borderRadius: radius.full }, mode === 'category' && { backgroundColor: tokens.chipActiveBg }]}
          >
            <Text style={{ color: tokens.text, fontSize: type.caption, fontFamily: fontFamily.bodySemiBold }}>Category</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="By group"
            onPress={() => onModeChange('group')}
            style={[styles.toggleBtn, { borderRadius: radius.full }, mode === 'group' && { backgroundColor: tokens.chipActiveBg }]}
          >
            <Text style={{ color: tokens.text, fontSize: type.caption, fontFamily: fontFamily.bodySemiBold }}>Group</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.donutWrap}>
        <DonutChart segments={segments} selectedKey={selectedKey} onSelect={setSelectedKey}>
          {selectedRow ? (
            <>
              {selectedRow.emoji ? <Text style={{ fontSize: 22 }}>{selectedRow.emoji}</Text> : null}
              <Text style={{ color: tokens.text, fontSize: type.body, fontFamily: fontFamily.bodySemiBold }}>
                {formatCurrency(selectedRow.spent, hideAmounts)}
              </Text>
              <Text style={{ color: tokens.text2, fontSize: type.caption, fontFamily: fontFamily.bodyMedium }}>
                {selectedRow.pct.toFixed(0)}%
              </Text>
            </>
          ) : (
            <>
              <Text style={{ color: tokens.text2, fontSize: type.caption, fontFamily: fontFamily.bodyMedium }}>Total</Text>
              <Text style={{ color: tokens.text, fontSize: type.body, fontFamily: fontFamily.bodySemiBold }}>
                {formatCurrency(totalSpent, hideAmounts)}
              </Text>
            </>
          )}
        </DonutChart>
      </View>

      <View style={{ marginTop: space.md, gap: space.sm }}>
        {visibleRows.map((row, i) => {
          const color = tokens[CHART_COLOR_CYCLE[i % CHART_COLOR_CYCLE.length]]
          const isSelected = selectedKey === row.key
          return (
            <Pressable
              key={row.key}
              onPress={() => setSelectedKey(isSelected ? null : row.key)}
              style={[styles.legendRow, isSelected && { opacity: 1 }, !isSelected && selectedKey != null && { opacity: 0.5 }]}
            >
              <View style={styles.legendTop}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                {row.emoji ? <Text style={{ fontSize: 13 }}>{row.emoji}</Text> : null}
                <Text
                  style={[styles.legendLabel, { color: tokens.text, fontFamily: fontFamily.bodyMedium, fontSize: type.caption }]}
                  numberOfLines={1}
                >
                  {row.label}
                </Text>
                <Text style={{ color: tokens.text, fontSize: type.caption, fontFamily: fontFamily.bodySemiBold }}>
                  {formatCurrency(row.spent, hideAmounts)}
                </Text>
                <Text style={{ color: tokens.text2, fontSize: type.caption, fontFamily: fontFamily.bodyMedium, width: 40, textAlign: 'right' }}>
                  {row.pct.toFixed(0)}%
                </Text>
                {row.deltaPct != null && (
                  <Text
                    style={{
                      color: row.deltaPct > 0 ? tokens.coral : tokens.mint,
                      fontSize: type.caption,
                      fontFamily: fontFamily.bodySemiBold,
                      width: 48,
                      textAlign: 'right',
                    }}
                  >
                    {row.deltaPct > 0 ? '▲' : '▼'}{Math.abs(row.deltaPct).toFixed(0)}%
                  </Text>
                )}
              </View>
              <View style={{ marginTop: space.xs }}>
                <ProgressBar pct={row.assigned > 0 ? (row.spent / row.assigned) * 100 : row.spent > 0 ? 100 : 0} />
              </View>
              <Text style={{ color: tokens.text3, fontSize: 11, fontFamily: fontFamily.bodyMedium, marginTop: 2 }}>
                {usedPctLabel(row)} of {formatCurrency(row.assigned, hideAmounts)} budgeted
              </Text>
            </Pressable>
          )
        })}
        {!expanded && hiddenCount > 0 && (
          <Pressable onPress={() => setExpanded(true)}>
            <Text style={{ color: tokens.accentInk, fontSize: type.caption, fontFamily: fontFamily.bodySemiBold }}>
              Other ({hiddenCount})
            </Text>
          </Pressable>
        )}
      </View>

      <Text style={{ color: tokens.text2, fontSize: type.caption, fontFamily: fontFamily.bodyMedium, marginTop: space.md }}>
        Left over in {monthLabel}: {formatCurrency(leftover, hideAmounts)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 },
  toggleGroup: { flexDirection: 'row', gap: 2, padding: 3 },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  donutWrap: { alignItems: 'center', marginTop: 12 },
  legendRow: { paddingVertical: 4 },
  legendTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendLabel: { flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
})
