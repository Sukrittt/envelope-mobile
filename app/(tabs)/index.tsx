import { useMemo, useState } from 'react'
import { View, Text, Pressable, RefreshControl, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronRight, ChevronsDownUp, LineChart } from 'lucide-react-native'
import Reanimated, { LinearTransition } from 'react-native-reanimated'
import { AnimatedTabContent } from '@/src/components/nav/AnimatedTabContent'
import { Icon } from '@/src/components/shared/Icon'
import { useTheme } from '@/src/theme/ThemeProvider'
import { usePrivacy } from '@/src/context/PrivacyContext'
import { fontFamily } from '@/src/theme/fonts'
import { useBudgets, useUpdateBudget, useAddBudget } from '@/src/hooks/useBudgets'
import { useExpenses } from '@/src/hooks/useExpenses'
import { useCategories } from '@/src/hooks/useCategories'
import { useGroups } from '@/src/hooks/useGroups'
import { computeEnvelopeState, currentMonthKey, daysLeftInMonth, monthLabel, type Envelope } from '@/src/lib/envelope'
import { formatCurrency } from '@/src/lib/format'
import { EMPTY } from '@/src/lib/constants'
import { LoadingCaption } from '@/src/components/shared/LoadingCaption'
import { useRefresh } from '@/src/hooks/useRefresh'
import { useCollapsedGroups } from '@/src/hooks/useCollapsedGroups'
import { EnvelopeGroup } from '@/src/components/envelope/EnvelopeGroup'
import { EnvelopeRow } from '@/src/components/envelope/EnvelopeRow'
import { Screen } from '@/src/components/ui/Screen'
import { Card } from '@/src/components/ui/Card'
import { IconButton } from '@/src/components/ui/Button'
import { AmountText } from '@/src/components/ui/AmountText'

/**
 * The month's state, and only that: what is left to assign, where it went, and
 * which envelopes are in trouble. The trend chart, heatmap and subscriptions
 * moved to /insights — six modules on one scroll left nothing room to be large.
 */
export default function HomeScreen() {
  const { tokens, space, type, radius } = useTheme()
  const { refreshing, onRefresh } = useRefresh()
  const router = useRouter()

  const budgetsQ = useBudgets()
  const expensesQ = useExpenses()
  const categoriesQ = useCategories()
  const groupsQ = useGroups()
  const updateBudget = useUpdateBudget()
  const addBudget = useAddBudget()

  const { hideAmounts } = usePrivacy()
  const [rolloverDismissed, setRolloverDismissed] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useCollapsedGroups('home')

  const budgets = budgetsQ.data ?? EMPTY
  const expenses = expensesQ.data ?? EMPTY
  const categories = categoriesQ.data ?? EMPTY
  const groups = groupsQ.data ?? EMPTY

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

  const allGroupNames = groupedEnvelopes.map((g) => g.group)
  const allGroupsCollapsed = allGroupNames.length > 0 && allGroupNames.every((g) => collapsedGroups.has(g))

  function toggleGroup(group: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  function toggleCollapseAll() {
    setCollapsedGroups(allGroupsCollapsed ? new Set() : new Set(allGroupNames))
  }

  const rolloverTotal = envelopeState.envelopes.reduce((s, e) => s + (e.rolledOver || 0), 0)
  const showRolloverBanner = !rolloverDismissed && rolloverTotal > 0

  async function handleEditAmount(category: string, newAssigned: number) {
    const exists = budgets.some((b) => b.month === month && b.category === category)
    if (exists) {
      await updateBudget.mutateAsync({ month, category, updates: { assigned: String(newAssigned) } })
    } else {
      await addBudget.mutateAsync({ month, category, assigned: String(newAssigned) })
    }
  }

  function handleMoveMoney(category: string) {
    router.push({ pathname: '/modals/move-money', params: { fromCategory: category } })
  }

  function handleViewTransactions(category: string) {
    router.push({ pathname: '/(tabs)/activity', params: { category } })
  }

  const isLoading = budgetsQ.isLoading || expensesQ.isLoading || categoriesQ.isLoading || groupsQ.isLoading
  const hasError = budgetsQ.error || expensesQ.error || categoriesQ.error || groupsQ.error

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: tokens.bg }]}>
        <LoadingCaption />
      </View>
    )
  }

  if (hasError) {
    return (
      <View style={[styles.center, { backgroundColor: tokens.bg, paddingHorizontal: space.xxl }]}>
        <Text style={{ color: tokens.coral, fontFamily: fontFamily.bodyMedium, textAlign: 'center' }}>
          Couldn&apos;t load your budget. Check your connection and reopen the app.
        </Text>
      </View>
    )
  }

  return (
    <AnimatedTabContent>
      <Screen
        title="Envelope"
        actions={
          <IconButton icon={LineChart} accessibilityLabel="Insights" onPress={() => router.push('/insights')} />
        }
        contentContainerStyle={{ gap: space.lg }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.accent} colors={[tokens.accent]} />
        }
      >
        {/* Ready to Assign is the one number the envelope method is about, so it
            is the hero rather than one tile among four. */}
        <View style={[styles.hero, { paddingVertical: space.xl }]}>
          <Text style={[styles.heroLabel, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>READY TO ASSIGN</Text>
          <AmountText
            value={envelopeState.readyToAssign}
            size={type.hero}
            color={envelopeState.isOverAssigned ? tokens.coral : tokens.text}
            weight="displayBold"
            animate
          />
          <Text style={{ color: tokens.text2, fontSize: type.caption, fontFamily: fontFamily.bodyMedium }}>
            {monthLabel(month)} · {daysLeftInMonth()} days left
          </Text>
        </View>

        {showRolloverBanner && (
          <Card style={styles.rolloverCard} elevated={false}>
            <Text style={{ color: tokens.text, fontSize: type.caption, fontFamily: fontFamily.bodySemiBold, flex: 1 }}>
              {formatCurrency(rolloverTotal, hideAmounts)} rolled over from last month across your envelopes.
            </Text>
            <Pressable onPress={() => setRolloverDismissed(true)} hitSlop={8}>
              <Text style={{ color: tokens.accentInk, fontSize: type.caption, fontFamily: fontFamily.bodySemiBold }}>Got it</Text>
            </Pressable>
          </Card>
        )}

        <Reanimated.View layout={LinearTransition.springify().damping(20).stiffness(200)}>
          <Card elevated={false}>
            <View style={styles.cardHeadRow}>
              <View style={[styles.headerLinks, { gap: space.xs }]}>
                <Text style={[styles.cardTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold, fontSize: type.bodyLg }]}>
                  Envelopes
                </Text>
                <IconButton
                  icon={ChevronsDownUp}
                  accessibilityLabel={allGroupsCollapsed ? 'Expand all' : 'Collapse all'}
                  onPress={toggleCollapseAll}
                  size={28}
                  color={tokens.accentInk}
                  background="transparent"
                />
              </View>
              <View style={styles.headerLinks}>
                <Pressable onPress={() => router.navigate('/(tabs)/envelopes')} hitSlop={8}>
                  <Text style={{ color: tokens.accentInk, fontSize: type.caption, fontFamily: fontFamily.bodySemiBold }}>Manage</Text>
                </Pressable>
              </View>
            </View>
            <View style={{ marginTop: space.xs }}>
              {groupedEnvelopes.map(({ group, envelopes }) => (
                <EnvelopeGroup
                  key={group}
                  group={group}
                  envelopes={envelopes}
                  hideAmounts={hideAmounts}
                  onMoveMoney={handleMoveMoney}
                  onEditAmount={handleEditAmount}
                  onViewTransactions={handleViewTransactions}
                  expanded={!collapsedGroups.has(group)}
                  onToggle={toggleGroup}
                />
              ))}
              {creditCardEnvelope && (
                <Reanimated.View
                  layout={LinearTransition.springify().damping(64).stiffness(600)}
                  style={[styles.ccWrap, { borderTopColor: tokens.border, paddingTop: space.sm, marginTop: space.sm }]}
                >
                  <View style={styles.ccBadgeRow}>
                    <Text style={{ fontSize: 9, fontWeight: '600', color: tokens.accentInk }}>PAYOFF</Text>
                  </View>
                  <EnvelopeRow
                    envelope={creditCardEnvelope}
                    emoji="💳"
                    displayName="Credit Card Payment"
                    hideAmounts={hideAmounts}
                    onMoveMoney={handleMoveMoney}
                    onEditAmount={handleEditAmount}
                    onViewTransactions={handleViewTransactions}
                  />
                </Reanimated.View>
              )}
            </View>
          </Card>
        </Reanimated.View>

        <Reanimated.View layout={LinearTransition.springify().damping(44).stiffness(400)}>
          <Pressable onPress={() => router.push('/insights')} style={[styles.insightsLink, { borderRadius: radius.lg }]}>
            <Text style={{ color: tokens.text2, fontSize: type.caption, fontFamily: fontFamily.bodySemiBold }}>
              Trends, daily spend and subscriptions
            </Text>
            <Icon icon={ChevronRight} size={16} color={tokens.text2} />
          </Pressable>
        </Reanimated.View>
      </Screen>
    </AnimatedTabContent>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', gap: 6 },
  heroLabel: { fontSize: 10, letterSpacing: 0.6 },
  rolloverCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: {},
  headerLinks: { flexDirection: 'row', alignItems: 'center' },
  insightsLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 14 },
  ccWrap: { borderTopWidth: 1 },
  ccBadgeRow: { flexDirection: 'row' },
})
