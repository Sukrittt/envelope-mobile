import { useMemo, useState } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { useBudgets, useUpdateBudget, useAddBudget } from '@/src/hooks/useBudgets'
import { useExpenses } from '@/src/hooks/useExpenses'
import { useCategories } from '@/src/hooks/useCategories'
import { useGroups } from '@/src/hooks/useGroups'
import { useSubscriptions } from '@/src/hooks/useSubscriptions'
import { computeEnvelopeState, currentMonthKey, type Envelope } from '@/src/lib/envelope'
import { formatCurrency } from '@/src/lib/format'
import { EnvelopeGroup } from '@/src/components/envelope/EnvelopeGroup'
import { EnvelopeRow } from '@/src/components/envelope/EnvelopeRow'
import { TrendChart, type TrendPoint } from '@/src/components/charts/TrendChart'
import { Heatmap, type HeatmapCell } from '@/src/components/charts/Heatmap'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

function daysLeftInMonth(): number {
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return daysInMonth - now.getDate()
}

export default function HomeScreen() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const budgetsQ = useBudgets()
  const expensesQ = useExpenses()
  const categoriesQ = useCategories()
  const groupsQ = useGroups()
  const subsQ = useSubscriptions()
  const updateBudget = useUpdateBudget()
  const addBudget = useAddBudget()

  const hideAmounts = false
  const [chartVariant, setChartVariant] = useState<'area' | 'bar'>('area')
  const [rolloverDismissed, setRolloverDismissed] = useState(false)

  const budgets = budgetsQ.data ?? []
  const expenses = expensesQ.data ?? []
  const categories = categoriesQ.data ?? []
  const groups = groupsQ.data ?? []
  const subscriptions = subsQ.data ?? []

  const month = currentMonthKey()

  const envelopeState = useMemo(
    () => computeEnvelopeState(budgets, expenses, month, categories, groups),
    [budgets, expenses, month, categories, groups],
  )

  const groupedEnvelopes = useMemo(() => {
    const byGroup = new Map<string, Envelope[]>()
    for (const e of envelopeState.envelopes) {
      if (e.isCreditCardPayment) continue
      const arr = byGroup.get(e.group) ?? []
      arr.push(e)
      byGroup.set(e.group, arr)
    }
    return envelopeState.groups
      .map((g) => ({ group: g, envelopes: byGroup.get(g) ?? [] }))
      .filter((g) => g.envelopes.length > 0)
  }, [envelopeState])

  const creditCardEnvelope = envelopeState.envelopes.find((e) => e.isCreditCardPayment)

  const trendData: TrendPoint[] = useMemo(() => {
    const totals = new Map<string, number>()
    for (const e of expenses) {
      totals.set(e.date, (totals.get(e.date) ?? 0) + (Number(e.amount_inr) || 0))
    }
    const dates = [...totals.keys()].sort().slice(-14)
    return dates.map((date) => ({ date, value: totals.get(date) ?? 0 }))
  }, [expenses])

  const heatmapCells: HeatmapCell[] = useMemo(() => {
    const totals = new Map<string, number>()
    for (const e of expenses) {
      if (!e.date.startsWith(month)) continue
      totals.set(e.date, (totals.get(e.date) ?? 0) + (Number(e.amount_inr) || 0))
    }
    const [y, m] = month.split('-').map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    const firstWeekday = (new Date(y, m - 1, 1).getDay() + 6) % 7 // Monday = 0
    const cells: HeatmapCell[] = []
    for (let i = 0; i < firstWeekday; i++) cells.push({ date: `pad-${i}`, day: 0, value: 0 })
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${month}-${String(d).padStart(2, '0')}`
      cells.push({ date, day: d, value: totals.get(date) ?? 0 })
    }
    return cells
  }, [expenses, month])

  const todayIso = new Date().toISOString().slice(0, 10)

  const insightText = useMemo(() => {
    const overspent = envelopeState.envelopes
      .filter((e) => e.isOverspent && !e.isCreditCardPayment)
      .sort((a, b) => a.available - b.available)
    if (overspent.length > 0) {
      return `${overspent[0].category} is overspent by ${formatCurrency(Math.abs(overspent[0].available), hideAmounts)} — the biggest drag this month.`
    }
    if (creditCardEnvelope && creditCardEnvelope.available > 0) {
      return `Credit card payment of ${formatCurrency(creditCardEnvelope.available, hideAmounts)} is set aside and ready to pay.`
    }
    const withBudget = envelopeState.envelopes.filter((e) => !e.isCreditCardPayment && e.assigned > 0)
    if (withBudget.length > 0) {
      const low = [...withBudget].sort((a, b) => a.available - b.available)[0]
      return `${low.category} has ${formatCurrency(low.available, hideAmounts)} left — keep an eye on it.`
    }
    return 'No spending data yet this month.'
  }, [envelopeState, creditCardEnvelope, hideAmounts])

  const activeSubs = subscriptions.filter((s) => /^active/i.test(s.status))
  const subsMonthlyTotal = activeSubs.reduce((s, sub) => s + (Number(sub.amount_inr) || 0), 0)

  const nonCcEnvelopes = envelopeState.envelopes.filter((e) => !e.isCreditCardPayment)
  const overspentCount = nonCcEnvelopes.filter((e) => e.isOverspent).length

  const rolloverTotal = envelopeState.envelopes.reduce((s, e) => s + (e.rolledOver || 0), 0)
  const showRolloverBanner = !rolloverDismissed && rolloverTotal > 0

  async function handleEditAmount(category: string, newAssigned: number) {
    const exists = budgets.some((b) => b.month === month && b.category === category)
    try {
      if (exists) {
        await updateBudget.mutateAsync({ month, category, updates: { assigned: String(newAssigned) } })
      } else {
        await addBudget.mutateAsync({ month, category, assigned: String(newAssigned) })
      }
    } catch {
      // Fire-and-forget, mirrors the web dashboard's optimistic budget edits.
    }
  }

  function handleMoveMoney(category: string) {
    router.push({ pathname: '/modals/move-money', params: { fromCategory: category } })
  }

  const isLoading = budgetsQ.isLoading || expensesQ.isLoading || categoriesQ.isLoading || groupsQ.isLoading
  const hasError = budgetsQ.error || expensesQ.error || categoriesQ.error || groupsQ.error

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: tokens.bg }]}>
        <ActivityIndicator color={tokens.gold} />
      </View>
    )
  }

  if (hasError) {
    return (
      <View style={[styles.center, { backgroundColor: tokens.bg, paddingHorizontal: 32 }]}>
        <Text style={{ color: tokens.coral, fontFamily: fontFamily.bodyMedium, textAlign: 'center' }}>
          Couldn't load your budget. Check your connection and reopen the app.
        </Text>
      </View>
    )
  }

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 14, backgroundColor: tokens.headerBg, borderBottomColor: tokens.border },
        ]}
      >
        <View style={styles.headerTop}>
          <Text style={[styles.greeting, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
            Hey Sukrit 👋
          </Text>
        </View>
        <View style={styles.headerSub}>
          <Text style={{ color: tokens.text2, fontSize: 12, fontFamily: fontFamily.bodyMedium }}>
            {monthLabel(month)} · {daysLeftInMonth()} days left
          </Text>
          <Text style={{ color: tokens.mint, fontSize: 12, fontFamily: fontFamily.bodySemiBold }}>
            {formatCurrency(envelopeState.readyToAssign, hideAmounts)} to assign
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {showRolloverBanner && (
          <View style={[styles.card, styles.rolloverCard, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
            <Text style={{ color: tokens.text, fontSize: 13, fontFamily: fontFamily.bodySemiBold, flex: 1 }}>
              {formatCurrency(rolloverTotal, hideAmounts)} rolled over from last month across your envelopes.
            </Text>
            <Pressable onPress={() => setRolloverDismissed(true)}>
              <Text style={{ color: tokens.gold, fontSize: 12, fontFamily: fontFamily.bodySemiBold }}>Got it</Text>
            </Pressable>
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statRow}>
          <View style={[styles.statCard, styles.statHero, { backgroundColor: tokens.card, borderColor: tokens.borderStrong }]}>
            <Text style={[styles.statLabel, { color: tokens.text2 }]}>READY TO ASSIGN</Text>
            <Text
              style={[
                styles.statHeroValue,
                { color: envelopeState.isOverAssigned ? tokens.coral : tokens.mint, fontFamily: fontFamily.displaySemiBold },
              ]}
            >
              {formatCurrency(envelopeState.readyToAssign, hideAmounts)}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
            <Text style={[styles.statLabel, { color: tokens.text2 }]}>INCOME</Text>
            <Text style={[styles.statValue, { color: tokens.text, fontFamily: fontFamily.bodyExtraBold }]}>
              {formatCurrency(envelopeState.income, hideAmounts)}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
            <Text style={[styles.statLabel, { color: tokens.text2 }]}>ASSIGNED</Text>
            <Text style={[styles.statValue, { color: tokens.text, fontFamily: fontFamily.bodyExtraBold }]}>
              {formatCurrency(envelopeState.totalAssigned, hideAmounts)}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
            <Text style={[styles.statLabel, { color: tokens.text2 }]}>OVERSPENT</Text>
            <Text
              style={[
                styles.statValue,
                { color: overspentCount > 0 ? tokens.coral : tokens.text, fontFamily: fontFamily.bodyExtraBold },
              ]}
            >
              {overspentCount}/{nonCcEnvelopes.length}
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
          <View style={styles.cardHeadRow}>
            <Text style={[styles.cardTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
              Spending trend
            </Text>
            <View style={[styles.toggleGroup, { backgroundColor: tokens.inputBg }]}>
              <Pressable
                onPress={() => setChartVariant('area')}
                style={[styles.toggleBtn, chartVariant === 'area' && { backgroundColor: tokens.chipActiveBg }]}
              >
                <Text style={{ color: tokens.text, fontSize: 12 }}>〜</Text>
              </Pressable>
              <Pressable
                onPress={() => setChartVariant('bar')}
                style={[styles.toggleBtn, chartVariant === 'bar' && { backgroundColor: tokens.chipActiveBg }]}
              >
                <Text style={{ color: tokens.text, fontSize: 12 }}>▊▍</Text>
              </Pressable>
            </View>
          </View>
          <TrendChart data={trendData} variant={chartVariant} />
        </View>

        <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
          <View style={styles.cardHeadRow}>
            <Text style={[styles.cardTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
              Envelopes
            </Text>
            <Pressable onPress={() => router.push('/(tabs)/envelopes')}>
              <Text style={{ color: tokens.gold, fontSize: 12, fontFamily: fontFamily.bodySemiBold }}>Manage →</Text>
            </Pressable>
          </View>
          <View style={{ marginTop: 4 }}>
            {groupedEnvelopes.map(({ group, envelopes }) => (
              <EnvelopeGroup
                key={group}
                group={group}
                envelopes={envelopes}
                hideAmounts={hideAmounts}
                onMoveMoney={handleMoveMoney}
                onEditAmount={handleEditAmount}
              />
            ))}
            {creditCardEnvelope && (
              <View style={[styles.ccWrap, { borderTopColor: tokens.border }]}>
                <View style={styles.ccBadgeRow}>
                  <Text style={{ fontSize: 9, fontWeight: '600', color: tokens.gold }}>PAYOFF</Text>
                </View>
                <EnvelopeRow
                  envelope={creditCardEnvelope}
                  emoji="💳"
                  displayName="Credit Card Payment"
                  hideAmounts={hideAmounts}
                  onMoveMoney={handleMoveMoney}
                  onEditAmount={handleEditAmount}
                />
              </View>
            )}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
          <Text style={[styles.cardTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>Insights</Text>
          <View style={{ marginTop: 12 }}>
            <Heatmap cells={heatmapCells} todayDate={todayIso} />
          </View>
          <Text style={{ color: tokens.mint, fontSize: 12, marginTop: 12, fontFamily: fontFamily.bodyMedium }}>
            {insightText}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
          <View style={styles.cardHeadRow}>
            <Text style={[styles.cardTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
              Subscriptions
            </Text>
            <Text style={{ color: tokens.text2, fontSize: 11, fontFamily: fontFamily.bodyMedium }}>
              {formatCurrency(subsMonthlyTotal, hideAmounts)}/mo
            </Text>
          </View>
          <Text style={{ color: tokens.text2, fontSize: 12, marginTop: 8, fontFamily: fontFamily.bodyMedium }}>
            {activeSubs.length} active subscription{activeSubs.length === 1 ? '' : 's'}
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting: { fontSize: 20 },
  headerSub: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  scrollContent: { padding: 16, paddingBottom: 110, gap: 16 },
  card: { padding: 18, borderRadius: 20, borderWidth: 1, gap: 4 },
  rolloverCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16 },
  statRow: { flexDirection: 'row', gap: 10, paddingBottom: 2 },
  statCard: { minWidth: 120, padding: 16, borderRadius: 20, borderWidth: 1 },
  statHero: { minWidth: 150 },
  statLabel: { fontSize: 10, letterSpacing: 0.6 },
  statHeroValue: { fontSize: 24, marginTop: 4 },
  statValue: { fontSize: 18, marginTop: 4 },
  toggleGroup: { flexDirection: 'row', gap: 2, padding: 3, borderRadius: 100 },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100 },
  ccWrap: { borderTopWidth: 1, paddingTop: 8, marginTop: 8 },
  ccBadgeRow: { flexDirection: 'row' },
})
