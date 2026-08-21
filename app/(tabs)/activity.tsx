import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useAudioPlayer } from 'expo-audio'
import { Plus } from 'lucide-react-native'
import { AnimatedTabContent } from '@/src/components/nav/AnimatedTabContent'
import { Icon } from '@/src/components/shared/Icon'
import { useTheme } from '@/src/theme/ThemeProvider'
import { usePrivacy } from '@/src/context/PrivacyContext'
import { fontFamily } from '@/src/theme/fonts'
import { formatCurrency } from '@/src/lib/format'
import { categoryEmoji, groupEmoji, splitEmoji } from '@/src/lib/emoji'
import { useExpenses, useDeleteExpense } from '@/src/hooks/useExpenses'
import { useCategories } from '@/src/hooks/useCategories'
import { useGroups } from '@/src/hooks/useGroups'
import { BottomSheet } from '@/src/components/shared/Modal'
import { SwipeableRow } from '@/src/components/activity/SwipeableRow'
import { DeletingRow } from '@/src/components/activity/DeletingRow'
import { LoadingCaption } from '@/src/components/shared/LoadingCaption'
import type { CategoryRow, ExpenseRow } from '@/src/types'

type PeriodKey = 'week' | 'month'

// Mirrors Web's TransactionsView.tsx INCOME_CATEGORIES set — colors/signs these
// as income instead of spend.
const INCOME_CATEGORIES = new Set(['Salary', 'Income', 'Refund', 'Cashback', 'Bonus', 'Interest', 'Gift', 'Transfer'])

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatTime(ts: string): string {
  const m = ts.match(/T(\d{2}:\d{2})/)
  return m ? m[1] : ''
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

type TimelineItem = { kind: 'header'; date: string; label: string; total: number } | { kind: 'txn'; txn: ExpenseRow }

function keyOf(t: ExpenseRow): string {
  return `t-${t.timestamp}-${t.item}`
}

export default function ActivityScreen() {
  const { tokens } = useTheme()
  const { hideAmounts } = usePrivacy()
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const expensesQ = useExpenses()
  const categoriesQ = useCategories()
  const groupsQ = useGroups()
  const deleteExpense = useDeleteExpense()
  // ponytail: delete.mp3 is a silent 300ms placeholder — swap the file for a real
  // effect (same filename/path) once one is provided, no code change needed.
  const deleteSound = useAudioPlayer(require('@/assets/sounds/delete.mp3'))

  const expenses = expensesQ.data ?? []
  const categories = categoriesQ.data ?? []
  const groups = groupsQ.data ?? []

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
    if (paramDate) setSelectedDate(paramDate)
  }, [paramDate])

  const [period, setPeriod] = useState<PeriodKey>('week')
  // Category drill-in from an envelope's "View transactions" action.
  const [selectedCategory, setSelectedCategory] = useState(paramCategory)
  useEffect(() => {
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
  // Currently swiped-open row's close fn + key — snapped shut on blur so the
  // edit/delete panel is never left revealed when the user returns to this tab.
  const openRowRef = useRef<{ key: string; close: () => void } | null>(null)
  useFocusEffect(
    useCallback(() => {
      return () => {
        openRowRef.current?.close()
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
    } else {
      const end = new Date(latestDate)
      let start: Date
      if (period === 'week') {
        start = new Date(end)
        const diffToMonday = (start.getDay() + 6) % 7
        start.setDate(end.getDate() - diffToMonday)
        start.setHours(0, 0, 0, 0)
      } else {
        start = new Date(end.getFullYear(), end.getMonth(), 1)
      }
      rows = rows.filter((e) => {
        const d = new Date(e.date)
        return d >= start && d <= end
      })
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
  }, [expenses, period, selectedDate, selectedCategory, search, latestDate])

  const grouped: TimelineItem[] = useMemo(() => {
    const byDate = new Map<string, ExpenseRow[]>()
    for (const e of filtered) {
      const arr = byDate.get(e.date) ?? []
      arr.push(e)
      byDate.set(e.date, arr)
    }
    const items: TimelineItem[] = []
    for (const [date, txns] of byDate) {
      const total = txns.reduce((s, t) => s + (Number(t.amount_inr) || 0), 0)
      items.push({ kind: 'header', date, label: formatDateHeader(date), total })
      for (const t of txns) items.push({ kind: 'txn', txn: t })
    }
    return items
  }, [filtered])

  const totalSpend = useMemo(() => filtered.reduce((s, e) => s + (Number(e.amount_inr) || 0), 0), [filtered])

  function openEdit(t: ExpenseRow) {
    setSheetTxn(null)
    router.push({
      pathname: '/modals/log-expense',
      params: {
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
    deleteSound.seekTo(0)
    deleteSound.play()
    deleteExpense.mutate({ timestamp: t.timestamp, item: t.item, amountInr: Number(t.amount_inr) || 0 })
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
          Couldn't load transactions. Check your connection and reopen the app.
        </Text>
      </View>
    )
  }

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <View
        style={[styles.header, { paddingTop: insets.top + 14, backgroundColor: tokens.headerBg, borderBottomColor: tokens.border }]}
      >
        <Text style={[styles.title, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>Activity</Text>
      </View>

      <AnimatedTabContent>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 110 }]}>
        <Pressable onPress={() => router.push('/modals/log-expense')} style={[styles.addButton, { backgroundColor: tokens.gold }]}>
          <Icon icon={Plus} size={16} color={tokens.onAccent} />
          <Text style={[styles.addButtonText, { color: tokens.onAccent, fontFamily: fontFamily.bodyBold }]}>Log expense</Text>
        </Pressable>

        <View style={styles.filterRow}>
          {(['week', 'month'] as PeriodKey[]).map((key) => {
            const active = period === key
            return (
              <Pressable
                key={key}
                onPress={() => setPeriod(key)}
                style={[styles.periodChip, { backgroundColor: active ? tokens.gold : tokens.pillBg, borderColor: active ? tokens.gold : tokens.border }]}
              >
                <Text style={[styles.chipText, { color: active ? tokens.onAccent : tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>
                  {key === 'week' ? 'This week' : 'This month'}
                </Text>
              </Pressable>
            )
          })}
        </View>

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

        <Pressable
          onPress={() => setCategorySheetOpen(true)}
          style={[styles.categoryTrigger, { backgroundColor: tokens.pillBg, borderColor: tokens.border }]}
        >
          <Text style={[styles.chipText, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>
            {selectedCategory ? `${categoryEmoji(selectedCategory)} ${splitEmoji(selectedCategory).text}` : 'All categories'}
          </Text>
          <Text style={{ color: tokens.text2, fontSize: 12 }}>▾</Text>
        </Pressable>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search transactions…"
          placeholderTextColor={tokens.text3}
          style={[styles.search, { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text, fontFamily: fontFamily.bodyMedium }]}
        />

        {grouped.length === 0 ? (
          <View style={[styles.card, styles.emptyCard, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
            <Text style={{ color: tokens.text2, fontFamily: fontFamily.bodyMedium, textAlign: 'center' }}>
              No transactions for this filter.
            </Text>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
            {grouped.map((item, i) =>
              item.kind === 'header' ? (
                <View
                  key={`h-${item.date}`}
                  style={[styles.dateHeader, i > 0 && { borderTopColor: tokens.border, borderTopWidth: StyleSheet.hairlineWidth }]}
                >
                  <Text style={[styles.dateHeaderLabel, { color: tokens.text2, fontFamily: fontFamily.bodyBold }]}>{item.label}</Text>
                  <Text style={[styles.dateHeaderTotal, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>
                    {formatCurrency(item.total, hideAmounts)}
                  </Text>
                </View>
              ) : (
                <DeletingRow
                  key={keyOf(item.txn)}
                  active={pendingDelete !== null && keyOf(pendingDelete) === keyOf(item.txn)}
                  onDone={() => {
                    if (pendingDelete) runDelete(pendingDelete)
                    setPendingDelete(null)
                  }}
                >
                  <SwipeableRow
                    rowKey={keyOf(item.txn)}
                    onDelete={() => confirmDelete(item.txn)}
                    onEdit={() => openEdit(item.txn)}
                    onOpen={(key, close) => {
                      if (openRowRef.current && openRowRef.current.key !== key) {
                        openRowRef.current.close()
                      }
                      openRowRef.current = { key, close }
                    }}
                  >
                    <Pressable onPress={() => setSheetTxn(item.txn)} style={[styles.row, { backgroundColor: tokens.cardSolid }]}>
                      <View style={[styles.icon, { backgroundColor: tokens.pillBg }]}>
                        <Text style={{ fontSize: 15 }}>{categoryEmoji(item.txn.category)}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.rowItem, { color: tokens.text, fontFamily: fontFamily.bodyMedium }]} numberOfLines={1}>
                          {item.txn.item}
                        </Text>
                        <Text style={[styles.rowMeta, { color: tokens.text3, fontFamily: fontFamily.bodyMedium }]} numberOfLines={1}>
                          {formatTime(item.txn.timestamp)} · {splitEmoji(item.txn.category).text}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.rowAmount,
                          { color: INCOME_CATEGORIES.has(item.txn.category) ? tokens.mint : tokens.coral, fontFamily: fontFamily.bodySemiBold },
                        ]}
                      >
                        {INCOME_CATEGORIES.has(item.txn.category) ? '+' : '-'}
                        {formatCurrency(Number(item.txn.amount_inr) || 0, hideAmounts)}
                      </Text>
                    </Pressable>
                  </SwipeableRow>
                </DeletingRow>
              ),
            )}
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
      </ScrollView>
      </AnimatedTabContent>

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
          Remove "{deleteTxn?.item}"? This cannot be undone.
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
          Filter by category
        </Text>
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
            style={[styles.categoryOption, selectedCategory === '' && { backgroundColor: tokens.chipActiveBg }]}
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
                  {group.items.map((c) => (
                    <Pressable
                      key={c.name}
                      style={[styles.categoryOption, selectedCategory === c.name && { backgroundColor: tokens.chipActiveBg }]}
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
              ),
          )}
          {categorySearch.trim() && filteredCategories.length === 0 && (
            <Text style={{ color: tokens.text3, fontFamily: fontFamily.bodyMedium, textAlign: 'center', paddingTop: 32 }}>
              No categories found
            </Text>
          )}
        </ScrollView>
      </BottomSheet>
    </View>
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
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1 },
  title: { fontSize: 20 },
  scrollContent: { padding: 16, gap: 14 },
  addButton: { flexDirection: 'row', gap: 6, borderRadius: 100, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  addButtonText: { fontSize: 14 },
  filterRow: { flexDirection: 'row', gap: 8 },
  dateChip: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8 },
  periodChip: { borderWidth: 1, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 9 },
  categoryTrigger: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  categorySheetScroll: { height: 420 },
  categorySearch: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, marginBottom: 8 },
  categoryOption: { paddingVertical: 12, paddingHorizontal: 8, borderRadius: 12 },
  categoryOptionText: { fontSize: 14 },
  categoryGroupLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 2, paddingHorizontal: 8 },
  chipText: { fontSize: 12 },
  search: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, fontSize: 13 },
  card: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14 },
  emptyCard: { paddingVertical: 24, minHeight: 96, justifyContent: 'center' },
  dateHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, paddingTop: 14 },
  dateHeaderLabel: { fontSize: 12 },
  dateHeaderTotal: { fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderRadius: 16 },
  icon: { width: 34, height: 34, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rowItem: { fontSize: 13 },
  rowMeta: { fontSize: 11, marginTop: 2 },
  rowAmount: { fontSize: 13 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 4 },
  sheetTitle: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, textAlign: 'center' },
  confirmTitle: { fontSize: 17, textAlign: 'center', marginBottom: 6 },
  confirmBody: { fontSize: 13, textAlign: 'center', marginBottom: 8 },
  sheetOption: { paddingVertical: 14, alignItems: 'center' },
  sheetOptionText: { fontSize: 16 },
})
