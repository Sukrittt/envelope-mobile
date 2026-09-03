import { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Play } from 'lucide-react-native'
import Reanimated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useTheme } from '@/src/theme/ThemeProvider'
import { usePrivacy } from '@/src/context/PrivacyContext'
import { fontFamily } from '@/src/theme/fonts'
import { formatCurrency } from '@/src/lib/format'
import { CHART_COLOR_CYCLE } from '@/src/theme/chartColors'
import { PopIn } from '@/src/components/shared/PopIn'
import { AmountText } from '@/src/components/ui/AmountText'
import { DonutChart } from './DonutChart'
import { useReveal } from './useReveal'
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

// Rows land after the donut's wipe is already underway, one behind the next.
// The index is capped so a long list doesn't trail off past the fold.
const ROW_START_DELAY = 200
const ROW_STAGGER_MS = 40
const ROW_STAGGER_CAP = 6
/** Each bar fills just after its own row has settled into place. */
const BAR_OFFSET_MS = 60
const BAR_DURATION = 450

/** Spend-vs-own-budget bar: 100% of the track is "fully spent this
 *  category's budget", so the fill length is self-explanatory with no
 *  legend needed — same convention as the rest of the app's ProgressBar.
 *  Turns coral past 100% instead of overflowing the track. No bar at all
 *  when there's no budget to measure against.
 *
 *  Not `envelope/ProgressBar`: that one owns the mint/warn/coral threshold
 *  palette (the Android widget depends on those thresholds too), while this
 *  bar fills with its row's own chart colour. The fill is a mount-only
 *  0 -> pct reveal, so there's no threshold hand-over to stage either. */
function BudgetBar({
  spent,
  assigned,
  color,
  tokens,
  play,
  delay,
}: {
  spent: number
  assigned: number
  color: string
  tokens: ThemeTokens
  play: boolean
  delay: number
}) {
  const pct = (spent / assigned) * 100
  const over = pct > 100
  const target = Math.min(100, pct)

  const progress = useSharedValue(play ? 0 : 1)
  useEffect(() => {
    if (!play) return
    progress.value = withDelay(delay, withTiming(1, { duration: BAR_DURATION, easing: Easing.inOut(Easing.cubic) }))
    // Intentionally runs once for this bar's own mount — `play` and `delay` are
    // read only for their initial value, not tracked reactively (same as PopIn).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * target}%` }), [target])

  return (
    <View style={[styles.barTrack, { backgroundColor: tokens.borderStrong }]}>
      <Reanimated.View style={[styles.barFill, { backgroundColor: over ? tokens.coral : color }, fillStyle]} />
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
  const [sortBy, setSortBy] = useState<'spend' | 'budget'>('spend')

  const canFilterVariable = mode === 'category' && rows.some((r) => fixedCategories.has(r.key))

  const displayRows = useMemo(() => {
    const filtered = canFilterVariable && variableOnly ? rows.filter((r) => !fixedCategories.has(r.key)) : rows
    const total = filtered.reduce((s, r) => s + r.spent, 0) || 1
    return filtered.map((r) => ({ ...r, pct: (r.spent / total) * 100 }))
  }, [rows, canFilterVariable, variableOnly, fixedCategories])

  const displayTotal = useMemo(() => displayRows.reduce((s, r) => s + r.spent, 0), [displayRows])

  // Every entrance on this card runs off one cue: the screen has settled after
  // its push transition and there are real rows to show. Bumps again whenever
  // the rows are swapped out (month, mode, or the variable-only filter), which
  // is what makes a mode switch re-wipe the donut and refill the bars from 0.
  const revealKey = useReveal(`${monthLabel}|${mode}|${variableOnly}`, displayRows.length > 0)
  const play = revealKey > 0

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

  // Row order for the legend list only — the donut and its colors stay keyed
  // to spend order regardless, so slices never reshuffle when this toggles.
  const sortedRows = useMemo(() => {
    if (sortBy === 'spend') return displayRows
    const withBudget = displayRows.filter((r) => !r.assignedIsCarried && r.assigned > 0)
    const withoutBudget = displayRows.filter((r) => r.assignedIsCarried || r.assigned <= 0)
    withBudget.sort((a, b) => b.spent / b.assigned - a.spent / a.assigned)
    return [...withBudget, ...withoutBudget]
  }, [displayRows, sortBy])

  const visibleRows = expanded ? sortedRows : sortedRows.slice(0, VISIBLE_ROWS)
  const hiddenCount = sortedRows.length - VISIBLE_ROWS

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

        <View style={styles.controlsRight}>
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
          <View style={[styles.measureToggle, { backgroundColor: tokens.inputBg, borderRadius: radius.full }]}>
            <Pressable
              accessibilityLabel="Measure by amount spent"
              onPress={() => setSortBy('spend')}
              style={[styles.measureCell, { borderRadius: radius.full }, sortBy === 'spend' && { backgroundColor: tokens.chipActiveBg }]}
            >
              <Text style={{ color: tokens.text, fontSize: type.body, fontFamily: fontFamily.bodyBold }}>₹</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Measure by percent of budget used"
              onPress={() => setSortBy('budget')}
              style={[styles.measureCell, { borderRadius: radius.full }, sortBy === 'budget' && { backgroundColor: tokens.chipActiveBg }]}
            >
              <Text style={{ color: tokens.text, fontSize: type.body, fontFamily: fontFamily.bodyBold }}>%</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.donutWrap}>
        <DonutChart segments={segments} selectedKey={donutSelectedKey} onSelect={onSelectKey} revealKey={revealKey}>
          {/* Held back until the reveal fires, so the label never sits alone in
              an undrawn ring. Keyed so each swap is a genuine remount, and
              driven by PopIn rather than an `entering` prop: this deep inside a
              ScrollView `entering` may never fire, which left the swap with no
              transition at all. AmountText's own `id` carries the odometer's
              previous value across these remounts. */}
          {play && (
          <PopIn key={`${revealKey}:${selectedKey ?? '__none__'}`} play delay={0} style={styles.centerBlock}>
          {selectedRow ? (
            <>
              {selectedRow.emoji ? <Text style={{ fontSize: 22 }}>{selectedRow.emoji}</Text> : null}
              <AmountText
                value={selectedRow.spent}
                size={type.body}
                weight="bodySemiBold"
                animate
                id="insights-donut-center"
              />
              <Text style={{ color: tokens.text2, fontSize: type.caption, fontFamily: fontFamily.bodyMedium }}>
                {selectedRow.pct.toFixed(0)}%
              </Text>
            </>
          ) : centerDelta ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <View
                  style={{
                    transform: [{ rotate: centerDelta.deltaPct! > 0 ? '-90deg' : '90deg' }],
                  }}
                >
                  <Play
                    size={12}
                    color={centerDelta.deltaPct! > 0 ? tokens.coral : tokens.mint}
                    fill={centerDelta.deltaPct! > 0 ? tokens.coral : tokens.mint}
                  />
                </View>
                <Text
                  style={{
                    color: centerDelta.deltaPct! > 0 ? tokens.coral : tokens.mint,
                    fontSize: type.body,
                    fontFamily: fontFamily.bodySemiBold,
                  }}
                >
                  {Math.abs(centerDelta.deltaPct!).toFixed(0)}%
                </Text>
              </View>
              <Text style={{ color: tokens.text2, fontSize: 11, fontFamily: fontFamily.bodyMedium, textAlign: 'center' }}>
                {formatCurrency(Math.abs(centerDelta.spent - centerDelta.baseline!), hideAmounts)}{' '}
                {centerDelta.deltaPct! > 0 ? 'more' : 'less'} than usual
              </Text>
            </>
          ) : displayRows[0] ? (
            <>
              {displayRows[0].emoji ? <Text style={{ fontSize: 22 }}>{displayRows[0].emoji}</Text> : null}
              <Text style={{ color: tokens.text, fontSize: type.body, fontFamily: fontFamily.bodySemiBold }}>
                {displayRows[0].label}
              </Text>
              <Text style={{ color: tokens.text2, fontSize: type.caption, fontFamily: fontFamily.bodyMedium }}>
                {displayRows[0].pct.toFixed(0)}%
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
          </PopIn>
          )}
        </DonutChart>
      </View>

      <View style={{ marginTop: space.md, gap: space.sm }}>
        {visibleRows.map((row, i) => {
          const color = colorByKey.get(row.key) ?? tokens.text3
          const isSelected = selectedKey === row.key
          const hasBudget = !row.assignedIsCarried && row.assigned > 0
          const rowDelay = ROW_START_DELAY + Math.min(i, ROW_STAGGER_CAP) * ROW_STAGGER_MS
          return (
            // The revealKey prefix is what makes the row remount on a replay:
            // PopIn and BudgetBar both read `play`/`delay` on their own mount
            // only, so a fresh instance is how they run again.
            <PopIn key={`${revealKey}:${row.key}`} play={play} delay={rowDelay}>
            <Pressable
              onPress={() => onSelectKey(isSelected ? null : row.key)}
              style={[isSelected && { opacity: 1 }, !isSelected && selectedKey != null && { opacity: 0.5 }]}
            >
              <View style={styles.legendTop}>
                {/* Dot stays even when there's an emoji: it's the only thing
                    tying this row to its wedge in the donut above. */}
                <View style={[styles.legendDot, { backgroundColor: color }]} />
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
                {row.deltaPct != null && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', width: 32, gap: 2 }}>
                    <View style={{ transform: [{ rotate: row.deltaPct > 0 ? '-90deg' : '90deg' }] }}>
                      <Play
                        size={8}
                        color={row.deltaPct > 0 ? tokens.coral : tokens.mint}
                        fill={row.deltaPct > 0 ? tokens.coral : tokens.mint}
                      />
                    </View>
                    <Text
                      style={{
                        color: row.deltaPct > 0 ? tokens.coral : tokens.mint,
                        fontSize: 10,
                        fontFamily: fontFamily.bodySemiBold,
                      }}
                    >
                      {Math.abs(row.deltaPct).toFixed(0)}%
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ marginTop: space.xs }}>
                {hasBudget ? (
                  <BudgetBar
                    spent={row.spent}
                    assigned={row.assigned}
                    color={color}
                    tokens={tokens}
                    play={play}
                    delay={rowDelay + BAR_OFFSET_MS}
                  />
                ) : (
                  <View style={[styles.barTrack, { backgroundColor: tokens.borderStrong }]} />
                )}
              </View>
              <Text style={{ color: tokens.text3, fontSize: 11, fontFamily: fontFamily.bodyMedium, marginTop: 6 }}>
                {hasBudget
                  ? `${formatCurrency(row.spent, hideAmounts)} of ${formatCurrency(row.assigned, hideAmounts)}`
                  : 'No budget set'}
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
            </PopIn>
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

      <View
        style={[
          styles.leftoverRow,
          { borderTopColor: tokens.border, marginTop: space.md, paddingTop: space.md },
        ]}
      >
        <Text style={{ color: tokens.text2, fontSize: type.caption, fontFamily: fontFamily.bodyMedium }}>
          Income left in {monthLabel}
        </Text>
        <Text style={{ color: tokens.text, fontSize: type.body, fontFamily: fontFamily.bodySemiBold }}>
          {formatCurrency(leftover, hideAmounts)}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  controlsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  toggleGroup: { flexDirection: 'row', gap: 2, padding: 3 },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  controlsRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
  measureToggle: { flexDirection: 'row', width: 64, padding: 3, gap: 2 },
  measureCell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 5 },
  donutWrap: { alignItems: 'center', marginTop: 16 },
  centerBlock: { alignItems: 'center' },
  legendTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendLabel: { flex: 1 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  barTrack: { height: 6, borderRadius: 100, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 100 },
  leftoverRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth },
})
