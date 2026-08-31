import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { SlidersHorizontal } from 'lucide-react-native'
import type { ThemeTokens } from '@/src/theme/tokens'
import { AnimatedTabContent } from '@/src/components/nav/AnimatedTabContent'
import { Screen } from '@/src/components/ui/Screen'
import { Chip } from '@/src/components/ui/Chip'
import { IconButton } from '@/src/components/ui/Button'
import { useTheme } from '@/src/theme/ThemeProvider'
import { usePrivacy } from '@/src/context/PrivacyContext'
import { fontFamily } from '@/src/theme/fonts'
import { formatCurrency } from '@/src/lib/format'
import { categoryEmoji, groupEmoji, splitEmoji } from '@/src/lib/emoji'
import { useExpenses, useDeleteExpense } from '@/src/hooks/useExpenses'
import { useCategories } from '@/src/hooks/useCategories'
import { useGroups } from '@/src/hooks/useGroups'
import { BottomSheet } from '@/src/components/shared/Modal'
import { DatePicker, type DateRange } from '@/src/components/shared/DatePicker'
import { useRefresh } from '@/src/hooks/useRefresh'
import { SwipeableRow } from '@/src/components/activity/SwipeableRow'
import { DeletingRow } from '@/src/components/activity/DeletingRow'
import { LoadingCaption } from '@/src/components/shared/LoadingCaption'
import type { CategoryRow, ExpenseRow } from '@/src/types'
import { toISTDateString } from '@/src/lib/date'
import { EMPTY } from '@/src/lib/constants'

type PeriodKey = 'week' | 'month' | 'custom'

// Mirrors Web's TransactionsView.tsx INCOME_CATEGORIES set — colors/signs these
// as income instead of spend.
const INCOME_CATEGORIES = new Set(['Salary', 'Income', 'Refund', 'Cashback', 'Bonus', 'Interest', 'Gift', 'Transfer'])

function toDateInput(d: Date): string {
  return toISTDateString(d)
}

function formatDateHeader(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (iso === toDateInput(today)) return 'Today'
  if (iso === toDateInput(yesterday)) return 'Yesterday'
  return d.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}

function formatShortDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const day = d.getDate()
  const month = d.toLocaleDateString('en-IN', { month: 'short' })
  const year = String(d.getFullYear()).slice(2)
  return `${day} ${month} '${year}`
}

// Category avatars cycle through the existing soft-hue tokens (hash of the name) so
// the flat list reads with the same varied-but-controlled color as Slice's own rows,
// without inventing a new palette.
const AVATAR_HUES: ((t: ThemeTokens) => string)[] = [
  (t) => t.mintSoft,
  (t) => t.violetSoft,
  (t) => t.blueSoft,
  (t) => t.accentSoft,
  (t) => t.warnSoft,
  (t) => t.coralSoft,
]

function avatarColorFor(name: string, tokens: ThemeTokens): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_HUES[hash % AVATAR_HUES.length](tokens)
}

function keyOf(t: ExpenseRow): string {
  return `t-${t.timestamp}-${t.item}`
}

export default function ActivityScreen() {
  const { tokens, scheme } = useTheme()
  const { refreshing, onRefresh } = useRefresh()
  const { hideAmounts } = usePrivacy()
  const router = useRouter()

  const expensesQ = useExpenses()
  const categoriesQ = useCategories()
  const groupsQ = useGroups()
  const deleteExpense = useDeleteExpense()

  const expenses = expensesQ.data ?? EMPTY
  const categories = categoriesQ.data ?? EMPTY
  const groups = groupsQ.data ?? EMPTY

  // Grouped so the filter sheet can be scanned by group instead of one long
  // flat scroll of every category (mirrors envelopes.tsx's groupedCategories).
  const groupedCategories = useMemo(() => {
    const byGroup = new Map<string, CategoryRow[]>()
    for (const c of categories) {
      const g = c.group || ''
      const arr = byGroup.get(g) ?? []
      arr.push(c)
      byGroup.set(g, arr)
    }
    const named = groups.map((g) => ({ name: g, items: byGroup.get(g) ?? [] }))
    const other = byGroup.get('') ?? []
    return other.length > 0 ? [...named, { name: '', items: other }] : named
  }, [categories, groups])

  const params = useLocalSearchParams<{ date?: string; category?: string }>()
  const paramDate = typeof params.date === 'string' ? params.date : ''
  const paramCategory = typeof params.category === 'string' ? params.category : ''
  // Date drill-in from the Insights heatmap: show only that day's transactions.
  const [selectedDate, setSelectedDate] = useState(paramDate)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs local (user-clearable) filter to an incoming route param, not derivable from render
    if (paramDate) setSelectedDate(paramDate)
  }, [paramDate])

  const [period, setPeriod] = useState<PeriodKey>('week')
  const [customRange, setCustomRange] = useState<DateRange>({ from: '', to: '' })
  // Category drill-in from an envelope's "View transactions" action.
  const [selectedCategory, setSelectedCategory] = useState(paramCategory)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs local (user-clearable) filter to an incoming route param, not derivable from render
    if (paramCategory) setSelectedCategory(paramCategory)
  }, [paramCategory])
  const [search, setSearch] = useState('')
  // Row supports swipe-left (delete) / swipe-right (edit) via SwipeableRow;
  // tap still opens this Edit/Delete action sheet as a non-swipe fallback.
  const [sheetTxn, setSheetTxn] = useState<ExpenseRow | null>(null)
  const [deleteTxn, setDeleteTxn] = useState<ExpenseRow | null>(null)
  // Set once the confirm sheet's Delete is tapped; drives the row's collapse
  // animation in DeletingRow. The actual mutate() call is deferred until that
  // animation finishes (see its onDone), so the refetch-driven removal never
  // pops a still-visible row.
  const [pendingDelete, setPendingDelete] = useState<ExpenseRow | null>(null)
  const [categorySheetOpen, setCategorySheetOpen] = useState(false)
  const [categorySearch, setCategorySearch] = useState('')
  // Currently swiped-open row's close/reset fns + key — snapped shut on blur so the
  // edit/delete panel is never left revealed when the user returns to this tab. Blur uses
  // `reset` (instant, no spring) rather than `close` (animated) — an animated close still
  // settling when the tab's fade transition starts would sweep the still-visible action
  // panel into that fade, flashing its background during the switch.
  const openRowRef = useRef<{ key: string; close: () => void; reset: () => void } | null>(null)
  useFocusEffect(
    useCallback(() => {
      return () => {
        openRowRef.current?.reset()
        openRowRef.current = null
      }
    }, []),
  )

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return groupedCategories
    const q = categorySearch.trim().toLowerCase()
    return groupedCategories
      .map((g) => ({ ...g, items: g.items.filter((c) => c.name.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0)
  }, [groupedCategories, categorySearch])

  const latestDate = useMemo(() => {
    if (expenses.length === 0) return new Date()
    let max = new Date(0)
    for (const e of expenses) {
      const d = new Date(e.date)
      if (!Number.isNaN(d.getTime()) && d > max) max = d
    }
    return max.getTime() === 0 ? new Date() : max
  }, [expenses])

  const filtered = useMemo(() => {
    let rows = expenses
    if (selectedDate) {
      rows = rows.filter((e) => e.date === selectedDate)
    } else if (period === 'custom') {
      if (customRange.from) rows = rows.filter((e) => e.date >= customRange.from)
      if (customRange.to) rows = rows.filter((e) => e.date <= customRange.to)
    } else {
      // Compare as IST calendar-date strings (like the customRange branch above) rather than
      // Date objects — avoids UTC/local timezone skew when the boundary falls near midnight IST.
      const endStr = toISTDateString(latestDate)
      let startStr: string
      if (period === 'week') {
        const start = new Date(latestDate)
        const diffToMonday = (start.getDay() + 6) % 7
        start.setDate(start.getDate() - diffToMonday)
        startStr = toISTDateString(start)
      } else {
        startStr = `${latestDate.getFullYear()}-${String(latestDate.getMonth() + 1).padStart(2, '0')}-01`
      }
      rows = rows.filter((e) => e.date >= startStr && e.date <= endStr)
    }
    if (selectedCategory) rows = rows.filter((e) => e.category === selectedCategory)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter((e) => e.item.toLowerCase().includes(q) || e.notes.toLowerCase().includes(q))
    }
    return [...rows].sort((a, b) => {
      const cmp = b.date.localeCompare(a.date)
      return cmp !== 0 ? cmp : b.timestamp.localeCompare(a.timestamp)
    })
  }, [expenses, period, selectedDate, selectedCategory, search, latestDate, customRange])

  const totalSpend = useMemo(() => filtered.reduce((s, e) => s + (Number(e.amount_inr) || 0), 0), [filtered])

  function openEdit(t: ExpenseRow) {
    setSheetTxn(null)
    router.push({
      pathname: '/modals/log-expense',
      params: {
        id: t.id ?? '',
        timestamp: t.timestamp,
        item: t.item,
        amountInr: t.amount_inr,
        category: t.category,
        date: t.date,
        notes: t.notes,
        paymentMethod: t.payment_method,
      },
    })
  }

  function confirmDelete(t: ExpenseRow) {
    setSheetTxn(null)
    setDeleteTxn(t)
  }

  function runDelete(t: ExpenseRow) {
    setDeleteTxn(null)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
    deleteExpense.mutate(
      { id: t.id, timestamp: t.timestamp, item: t.item, amountInr: Number(t.amount_inr) || 0 },
      // Left set on success so the row stays collapsed until the refetch drops
      // it — clearing it here springs the row back to full height for a whole
      // round trip. On failure the row does come back, which is the signal.
      { onError: () => setPendingDelete(null) },
    )
  }

  const isLoading = expensesQ.isLoading || categoriesQ.isLoading
  const hasError = expensesQ.error || categoriesQ.error

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: tokens.bg }]}>
        <LoadingCaption />
      </View>
    )
  }

  if (hasError) {
    return (
      <View style={[styles.center, { backgroundColor: tokens.bg, paddingHorizontal: 32 }]}>
        <Text style={{ color: tokens.coral, fontFamily: fontFamily.bodyMedium, textAlign: 'center' }}>
          Couldn&apos;t load transactions. Check your connection and reopen the app.
        </Text>
      </View>
    )
  }

  return (
    <AnimatedTabContent>
      <Screen
        title="Activity"
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.accent} colors={[tokens.accent]} />
        }
      >
        {/* No "Log expense" button here: the nav's centre action is always on
            screen and is the single entry point for the app's primary verb. */}
        {selectedDate ? (
          <Pressable
            onPress={() => setSelectedDate('')}
            style={[styles.dateChip, { backgroundColor: tokens.chipActiveBg, borderColor: tokens.border }]}
          >
            <Text style={[styles.chipText, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>
              {formatDateHeader(selectedDate)} ✕
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.searchRow}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search transactions"
            placeholderTextColor={tokens.text3}
            style={[styles.search, { backgroundColor: scheme === 'dark' ? tokens.cardSolid : tokens.inputBg, color: tokens.text, fontFamily: fontFamily.bodyMedium }]}
          />
          <IconButton icon={SlidersHorizontal} accessibilityLabel="Filter transactions" onPress={() => setCategorySheetOpen(true)} />
        </View>

        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ color: tokens.text2, fontFamily: fontFamily.bodyMedium, textAlign: 'center' }}>
              No transactions for this filter.
            </Text>
          </View>
        ) : (
          <View>
            {filtered.map((txn) => {
              const avatarBg = avatarColorFor(txn.category, tokens)
              return (
                <DeletingRow
                  key={keyOf(txn)}
                  active={pendingDelete !== null && keyOf(pendingDelete) === keyOf(txn)}
                  onDone={() => {
                    if (pendingDelete) runDelete(pendingDelete)
                  }}
                >
                  <SwipeableRow
                    rowKey={keyOf(txn)}
                    onDelete={() => confirmDelete(txn)}
                    onEdit={() => openEdit(txn)}
                    onOpen={(key, close, reset) => {
                      if (openRowRef.current && openRowRef.current.key !== key) {
                        openRowRef.current.close()
                      }
                      openRowRef.current = { key, close, reset }
                    }}
                  >
                    <Pressable onPress={() => setSheetTxn(txn)} style={[styles.row, { backgroundColor: tokens.bg }]}>
                      <View style={[styles.icon, { backgroundColor: avatarBg }]}>
                        <Text style={{ fontSize: 15 }}>{categoryEmoji(txn.category)}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.rowItem, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]} numberOfLines={1}>
                          {txn.item}
                        </Text>
                        <Text style={[styles.rowMeta, { color: tokens.text3, fontFamily: fontFamily.bodyMedium }]} numberOfLines={1}>
                          {formatShortDate(txn.date)} · {splitEmoji(txn.category).text}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.rowAmount,
                          { color: INCOME_CATEGORIES.has(txn.category) ? tokens.mint : tokens.text, fontFamily: fontFamily.bodySemiBold },
                        ]}
                      >
                        {formatCurrency(Number(txn.amount_inr) || 0, hideAmounts)}
                      </Text>
                    </Pressable>
                  </SwipeableRow>
                </DeletingRow>
              )
            })}
          </View>
        )}

        <View style={styles.footer}>
          <Text style={{ color: tokens.text2, fontSize: 12, fontFamily: fontFamily.bodyMedium }}>
            {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
          </Text>
          <Text style={{ color: tokens.text2, fontSize: 12, fontFamily: fontFamily.bodyMedium }}>
            Total: {formatCurrency(totalSpend, hideAmounts)}
          </Text>
        </View>

      <BottomSheet visible={sheetTxn !== null} onClose={() => setSheetTxn(null)}>
        <Text style={[styles.sheetTitle, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]} numberOfLines={1}>
          {sheetTxn?.item}
        </Text>
        <SheetOption label="Edit" color={tokens.text} onPress={() => sheetTxn && openEdit(sheetTxn)} />
        <SheetOption label="Delete" color={tokens.coral} onPress={() => sheetTxn && confirmDelete(sheetTxn)} />
        <SheetOption label="Cancel" color={tokens.text2} onPress={() => setSheetTxn(null)} />
      </BottomSheet>

      <BottomSheet visible={deleteTxn !== null} onClose={() => setDeleteTxn(null)}>
        <Text style={[styles.confirmTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
          Delete transaction
        </Text>
        <Text style={[styles.confirmBody, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]} numberOfLines={2}>
          Remove &quot;{deleteTxn?.item}&quot;? This cannot be undone.
        </Text>
        <SheetOption
          label="Delete"
          color={tokens.coral}
          onPress={() => {
            if (!deleteTxn) return
            setPendingDelete(deleteTxn)
            setDeleteTxn(null)
          }}
        />
        <SheetOption label="Cancel" color={tokens.text2} onPress={() => setDeleteTxn(null)} />
      </BottomSheet>

      <BottomSheet visible={categorySheetOpen} onClose={() => { setCategorySheetOpen(false); setCategorySearch('') }}>
        <Text style={[styles.sheetTitle, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>
          Filter
        </Text>
        <View style={styles.periodRow}>
          {(['week', 'month', 'custom'] as PeriodKey[]).map((key) => (
            <Chip
              key={key}
              selected={period === key}
              label={key === 'week' ? 'This week' : key === 'month' ? 'This month' : 'Custom range'}
              onPress={() => setPeriod(key)}
            />
          ))}
        </View>
        {period === 'custom' && (
          <View style={styles.customRangeWrap}>
            <DatePicker mode="range" value={customRange} onChange={setCustomRange} />
          </View>
        )}
        <TextInput
          value={categorySearch}
          onChangeText={setCategorySearch}
          placeholder="Search categories…"
          placeholderTextColor={tokens.text3}
          autoCorrect={false}
          style={[styles.categorySearch, { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text, fontFamily: fontFamily.bodyMedium }]}
        />
        <ScrollView style={styles.categorySheetScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Pressable
            style={[styles.categoryOption, { borderBottomColor: tokens.border }, selectedCategory === '' && { backgroundColor: tokens.chipActiveBg }]}
            onPress={() => {
              setSelectedCategory('')
              setCategorySheetOpen(false)
              setCategorySearch('')
            }}
          >
            <Text style={[styles.categoryOptionText, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>
              All categories
            </Text>
          </Pressable>
          {filteredCategories.map(
            (group) =>
              group.items.length > 0 && (
                <View key={group.name || 'other'}>
                  <Text style={[styles.categoryGroupLabel, { color: tokens.text3, fontFamily: fontFamily.bodyBold }]}>
                    {group.name ? `${groupEmoji(group.name)} ${splitEmoji(group.name).text}` : 'Other'}
                  </Text>
                  <View style={[styles.categoryGroupItems, { borderLeftColor: tokens.border }]}>
                    {group.items.map((c, i) => (
                      <Pressable
                        key={c.name}
                        style={[
                          styles.categoryOption,
                          i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.border },
                          selectedCategory === c.name && { backgroundColor: tokens.chipActiveBg },
                        ]}
                        onPress={() => {
                          setSelectedCategory(c.name)
                          setCategorySheetOpen(false)
                          setCategorySearch('')
                        }}
                      >
                        <Text style={[styles.categoryOptionText, { color: tokens.text, fontFamily: fontFamily.bodyMedium }]}>
                          {categoryEmoji(c.name, group.name)} {splitEmoji(c.name).text}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ),
          )}
          {categorySearch.trim() && filteredCategories.length === 0 && (
            <Text style={{ color: tokens.text3, fontFamily: fontFamily.bodyMedium, textAlign: 'center', paddingTop: 32 }}>
              No categories found
            </Text>
          )}
        </ScrollView>
      </BottomSheet>
      </Screen>
    </AnimatedTabContent>
  )
}

function SheetOption({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.sheetOption}>
      <Text style={[styles.sheetOptionText, { color, fontFamily: fontFamily.bodySemiBold }]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { gap: 4 },
  dateChip: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 10 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  categorySheetScroll: { height: 420 },
  categorySearch: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, marginBottom: 8 },
  categoryOption: { paddingVertical: 12, paddingHorizontal: 8, borderRadius: 12 },
  categoryOptionText: { fontSize: 14 },
  categoryGroupLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 2, paddingHorizontal: 8 },
  categoryGroupItems: { borderLeftWidth: StyleSheet.hairlineWidth, marginLeft: 8, paddingLeft: 4 },
  customRangeWrap: { marginBottom: 10 },
  chipText: { fontSize: 12 },
  search: { flex: 1, borderRadius: 100, paddingHorizontal: 18, paddingVertical: 13, fontSize: 14 },
  emptyState: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowItem: { fontSize: 15 },
  rowMeta: { fontSize: 12, marginTop: 2 },
  rowAmount: { fontSize: 15 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 4 },
  sheetTitle: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, textAlign: 'center' },
  confirmTitle: { fontSize: 17, textAlign: 'center', marginBottom: 6 },
  confirmBody: { fontSize: 13, textAlign: 'center', marginBottom: 8 },
  sheetOption: { paddingVertical: 14, alignItems: 'center' },
  sheetOptionText: { fontSize: 16 },
})
