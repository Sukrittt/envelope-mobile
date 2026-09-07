import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, Plus, Repeat } from 'lucide-react-native'
import { OfflineScreen } from '@/src/components/shared/OfflineScreen'
import { useOnline } from '@/src/lib/netStatus'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { Icon } from '@/src/components/shared/Icon'
import { LoadingPhrase } from '@/src/components/shared/LoadingPhrase'
import { usePrivacy } from '@/src/context/PrivacyContext'
import { formatCurrency, formatDateShort } from '@/src/lib/format'
import { splitEmoji } from '@/src/lib/emoji'
import { useRecurringExpenses } from '@/src/hooks/useRecurringExpenses'
import type { RecurringExpenseRow } from '@/src/types'

const LOADING_PHRASES = ['Checking what repeats…', 'Reading the calendar…', 'Almost there…']

const CADENCE_LABELS: Record<string, string> = {
  daily: 'Every day',
  weekly: 'Every week',
  monthly: 'Every month',
  yearly: 'Every year',
}

function cadenceLabel(frequency: string): string {
  return CADENCE_LABELS[frequency] ?? frequency
}

/**
 * `next_run_date` is rendered exactly as the server sent it. Deliberately no
 * local due-date math: SubscriptionsPanel's fork of that logic compares against
 * a live instant instead of UTC midnight, so anything due today reads there as
 * next cycle. One schedule owner, and it's the server.
 */
export default function RecurringExpensesScreen() {
  const { tokens } = useTheme()
  const { hideAmounts } = usePrivacy()
  const online = useOnline()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const recurringQ = useRecurringExpenses()

  const rows = recurringQ.data ?? []
  const active = rows.filter((r) => r.status === 'active')
  const inactive = rows.filter((r) => r.status !== 'active')

  const monthlyTotal = active.reduce((sum, r) => sum + monthlyEquivalent(r), 0)

  if (!online) return <OfflineScreen />

  return (
    <View style={[styles.container, { backgroundColor: tokens.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: tokens.border }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={[styles.backButton, { backgroundColor: tokens.card, borderColor: tokens.border }]}
        >
          <Icon icon={ArrowLeft} size={20} color={tokens.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
            Recurring
          </Text>
          <Text style={[styles.headerSub, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>
            {active.length === 0
              ? 'Nothing repeating yet'
              : `${active.length} active · about ${formatCurrency(monthlyTotal, hideAmounts)} a month`}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/modals/recurring-expense')}
          style={[styles.addButton, { backgroundColor: tokens.card, borderColor: tokens.border }]}
        >
          <Icon icon={Plus} size={16} color={tokens.text} />
          <Text style={[styles.addText, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>Add</Text>
        </Pressable>
      </View>

      {recurringQ.isLoading ? (
        <LoadingPhrase phrases={LOADING_PHRASES} color={tokens.text2} />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {rows.length === 0 ? (
            <View style={styles.empty}>
              <Icon icon={Repeat} size={28} color={tokens.text3} />
              <Text style={[styles.emptyTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
                Set it once, forget it
              </Text>
              <Text style={[styles.emptyBody, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
                Rent, the gym, your maid. Add it here and we&apos;ll log it for you on every due date.
              </Text>
            </View>
          ) : null}

          {active.length > 0 ? (
            <Section title="Active">
              {active.map((row) => (
                <RecurringRow key={row.id} row={row} />
              ))}
            </Section>
          ) : null}

          {inactive.length > 0 ? (
            <Section title="Paused and finished">
              {inactive.map((row) => (
                <RecurringRow key={row.id} row={row} />
              ))}
            </Section>
          ) : null}
        </ScrollView>
      )}
    </View>
  )

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: tokens.text3, fontFamily: fontFamily.bodyBold }]}>
          {title.toUpperCase()}
        </Text>
        <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>{children}</View>
      </View>
    )
  }

  function RecurringRow({ row }: { row: RecurringExpenseRow }) {
    const isActive = row.status === 'active'
    const category = splitEmoji(row.category)

    return (
      <Pressable
        onPress={() => router.push(`/modals/recurring-expense?id=${encodeURIComponent(row.id)}`)}
        style={styles.row}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>
            {row.item}
          </Text>
          <Text style={[styles.rowMeta, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
            {cadenceLabel(row.frequency)}
            {category.text ? ` · ${category.text}` : ''}
          </Text>
          <Text style={[styles.rowMeta, { color: isActive ? tokens.text3 : tokens.text3, fontFamily: fontFamily.bodyMedium }]}>
            {row.status === 'ended'
              ? 'Finished'
              : !isActive
                ? 'Paused'
                : row.next_run_date
                  ? `Next on ${formatDateShort(row.next_run_date)}`
                  : 'Not scheduled'}
          </Text>
        </View>
        <Text style={[styles.rowAmount, { color: tokens.text, fontFamily: fontFamily.bodySemiBold, opacity: isActive ? 1 : 0.5 }]}>
          {formatCurrency(Number(row.amount_inr) || 0, hideAmounts)}
        </Text>
      </Pressable>
    )
  }
}

/** Rough monthly cost, only for the header's at-a-glance total. */
function monthlyEquivalent(row: RecurringExpenseRow): number {
  const amount = Number(row.amount_inr) || 0
  switch (row.frequency) {
    case 'daily':
      return amount * 30
    case 'weekly':
      return (amount * 52) / 12
    case 'yearly':
      return amount / 12
    default:
      return amount
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 19 },
  headerSub: { fontSize: 11.5, marginTop: 1 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
  },
  addText: { fontSize: 12.5 },
  body: { padding: 16, gap: 20 },
  section: { gap: 8 },
  sectionLabel: { fontSize: 11, letterSpacing: 0.6 },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  rowTitle: { fontSize: 15 },
  rowMeta: { fontSize: 12, marginTop: 2 },
  rowAmount: { fontSize: 15 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, marginTop: 4 },
  emptyBody: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
})
