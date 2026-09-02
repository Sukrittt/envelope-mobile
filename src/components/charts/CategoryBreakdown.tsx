import { useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useTheme } from '@/src/theme/ThemeProvider'
import { usePrivacy } from '@/src/context/PrivacyContext'
import { fontFamily } from '@/src/theme/fonts'
import { formatCurrency } from '@/src/lib/format'
import { CHART_COLOR_CYCLE } from '@/src/theme/chartColors'
import { DonutChart } from './DonutChart'
import type { BreakdownRow, MonthComparison } from '@/src/lib/monthly'
import type { ThemeTokens } from '@/src/theme/tokens'

interface Props {
  rows: BreakdownRow[]
  mode: 'category' | 'group'
  onModeChange: (mode: 'category' | 'group') => void
  fixedCategories: Set<string>
  variableOnly: boolean
  onToggleVariableOnly: () => void
  /** Controlled selection, lifted to the screen so the heat map card can
   *  filter to the same category. */
  selectedKey: string | null
  onSelectKey: (key: string | null) => void
  comparison: MonthComparison | null
  leftover: number
  monthLabel: string
}

const VISIBLE_ROWS = 6
/** Slices below this share get bucketed into one "Other" wedge, so every
 *  slice left in the ring is big enough to tap — a 1% slice never was. */
const DONUT_TAIL_PCT = 3

/** Spend-vs-own-budget bar: 100% of the track is "fully spent this
 *  category's budget", so the fill length is self-explanatory with no
 *  legend needed — same convention as the rest of the app's ProgressBar.
 *  Turns coral past 100% instead of overflowing the track. No bar at all
 *  when there's no budget to measure against. */
function BudgetBar({
  spent,
  assigned,
  color,
  tokens,
}: {
  spent: number
  assigned: number
  color: string
  tokens: ThemeTokens
}) {
  const pct = (spent / assigned) * 100
  const over = pct > 100
  return (
    <View style={[styles.barTrack, { backgroundColor: tokens.borderStrong }]}>
      <View style={[styles.barFill, { width: `${Math.min(100, pct)}%`, backgroundColor: over ? tokens.coral : color }]} />
    </View>
  )
}

export function CategoryBreakdown({
  rows,
  mode,
  onModeChange,
  fixedCategories,
  variableOnly,
  onToggleVariableOnly,
  selectedKey,
  onSelectKey,
  comparison,
  leftover,
  monthLabel,
}: Props) {
  const { tokens, space, radius, type } = useTheme()
  const { hideAmounts } = usePrivacy()
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)

  const canFilterVariable = mode === 'category' && rows.some((r) => fixedCategories.has(r.key))

  const displayRows = useMemo(() => {
    const filtered = canFilterVariable && variableOnly ? rows.filter((r) => !fixedCategories.has(r.key)) : rows
    const total = filtered.reduce((s, r) => s + r.spent, 0) || 1
    return filtered.map((r) => ({ ...r, pct: (r.spent / total) * 100 }))
  }, [rows, canFilterVariable, variableOnly, fixedCategories])

  const displayTotal = useMemo(() => displayRows.reduce((s, r) => s + r.spent, 0), [displayRows])

  const colorByKey = useMemo(() => {
    const map = new Map<string, string>()
    displayRows.forEach((row, i) => map.set(row.key, tokens[CHART_COLOR_CYCLE[i % CHART_COLOR_CYCLE.length]]))
    return map
  }, [displayRows, tokens])

  const segments = useMemo(() => {
    const big = displayRows.filter((r) => r.pct >= DONUT_TAIL_PCT)
    const small = displayRows.filter((r) => r.pct < DONUT_TAIL_PCT)
    const result = big.map((row) => ({
      key: row.key,
      label: row.label,
      emoji: row.emoji,
      value: row.spent,
      color: colorByKey.get(row.key) ?? tokens.text3,
    }))
    if (small.length > 0) {
      result.push({
        key: '__other__',
        label: 'Other',
        emoji: '',
        value: small.reduce((s, r) => s + r.spent, 0),
        color: tokens.text3,
      })
    }
    return result
  }, [displayRows, colorByKey, tokens])

  const selectedRow = displayRows.find((r) => r.key === selectedKey) ?? null
  // A selected row bucketed into the donut's "Other" wedge (below the tail
  // threshold) still needs its wedge to light up, not nothing.
  const donutSelectedKey =
    selectedKey == null ? null : segments.some((s) => s.key === selectedKey) ? selectedKey : '__other__'
  const visibleRows = expanded ? displayRows : displayRows.slice(0, VISIBLE_ROWS)
  const hiddenCount = displayRows.length - VISIBLE_ROWS

  const centerDelta = comparison && comparison.baseline != null && comparison.deltaPct != null ? comparison : null

  return (
    <View>
      <View style={styles.controlsRow}>
        <View style={[styles.toggleGroup, { backgroundColor: tokens.inputBg, borderRadius: radius.full }]}>
          <Pressable
            accessibilityLabel="By category"
            onPress={() => onModeChange('category')}
            style={[styles.toggleBtn, { borderRadius: radius.full }, mode === 'category' && { backgroundColor: tokens.chipActiveBg }]}
          >
            <Text style={{ color: tokens.text, fontSize: type.caption, fontFamily: fontFamily.bodySemiBold }}>By category</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="By group"
            onPress={() => onModeChange('group')}
            style={[styles.toggleBtn, { borderRadius: radius.full }, mode === 'group' && { backgroundColor: tokens.chipActiveBg }]}
          >
            <Text style={{ color: tokens.text, fontSize: type.caption, fontFamily: fontFamily.bodySemiBold }}>By group</Text>
          </Pressable>
        </View>
        {canFilterVariable && (
          <Pressable
            accessibilityLabel="Variable spend only"
            onPress={onToggleVariableOnly}
            style={[
              styles.filterChip,
              { borderRadius: radius.full, borderColor: tokens.borderStrong },
              variableOnly && { backgroundColor: tokens.chipActiveBg, borderColor: tokens.chipActiveBg },
            ]}
          >
            <Text style={{ color: tokens.text, fontSize: type.caption, fontFamily: fontFamily.bodyMedium }}>Variable only</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.donutWrap}>
        <DonutChart segments={segments} selectedKey={donutSelectedKey} onSelect={onSelectKey}>
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
          ) : centerDelta ? (
            <>
              <Text
                style={{
                  color: centerDelta.deltaPct! > 0 ? tokens.coral : tokens.mint,
                  fontSize: type.body,
                  fontFamily: fontFamily.bodySemiBold,
                }}
              >
                {centerDelta.deltaPct! > 0 ? '▲' : '▼'} {Math.abs(centerDelta.deltaPct!).toFixed(0)}%
              </Text>
              <Text style={{ color: tokens.text2, fontSize: 11, fontFamily: fontFamily.bodyMedium, textAlign: 'center' }}>
                {formatCurrency(Math.abs(centerDelta.spent - centerDelta.baseline!), hideAmounts)}{' '}
                {centerDelta.deltaPct! > 0 ? 'more' : 'less'} than usual
              </Text>
            </>
          ) : (
            <>
              <Text style={{ color: tokens.text2, fontSize: type.caption, fontFamily: fontFamily.bodyMedium }}>Total</Text>
              <Text style={{ color: tokens.text, fontSize: type.body, fontFamily: fontFamily.bodySemiBold }}>
                {formatCurrency(displayTotal, hideAmounts)}
              </Text>
            </>
          )}
        </DonutChart>
      </View>

      <View style={{ marginTop: space.md, gap: space.sm }}>
        {visibleRows.map((row) => {
          const color = colorByKey.get(row.key) ?? tokens.text3
          const isSelected = selectedKey === row.key
          const hasBudget = !row.assignedIsCarried && row.assigned > 0
          return (
            <Pressable
              key={row.key}
              onPress={() => onSelectKey(isSelected ? null : row.key)}
              style={[isSelected && { opacity: 1 }, !isSelected && selectedKey != null && { opacity: 0.5 }]}
            >
              <View style={styles.legendTop}>
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
                {hasBudget ? (
                  <BudgetBar spent={row.spent} assigned={row.assigned} color={color} tokens={tokens} />
                ) : (
                  <View style={[styles.barTrack, { backgroundColor: tokens.borderStrong }]} />
                )}
              </View>
              <Text style={{ color: tokens.text3, fontSize: 11, fontFamily: fontFamily.bodyMedium, marginTop: 2 }}>
                {row.assignedIsCarried ? 'No budget set' : `${formatCurrency(row.assigned, hideAmounts)} budgeted`}
              </Text>
              {isSelected && mode === 'category' && (
                <Pressable
                  hitSlop={8}
                  onPress={() => router.push({ pathname: '/(tabs)/activity', params: { category: row.key } })}
                >
                  <Text style={{ color: tokens.accentInk, fontSize: 11, fontFamily: fontFamily.bodySemiBold, marginTop: 4 }}>
                    View transactions ›
                  </Text>
                </Pressable>
              )}
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
  controlsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  toggleGroup: { flexDirection: 'row', gap: 2, padding: 3 },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
  donutWrap: { alignItems: 'center', marginTop: 16 },
  legendTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendLabel: { flex: 1 },
  barTrack: { height: 6, borderRadius: 100, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 100 },
})
