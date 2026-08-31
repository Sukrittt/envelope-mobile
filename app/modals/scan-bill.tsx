import { useMemo, useState, type ReactNode } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import * as Haptics from 'expo-haptics'
import { X, ArrowLeft, Camera, Images, Plus, Trash2, Search, Check, type LucideIcon } from 'lucide-react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { NAV_HEIGHT } from '@/src/theme/scale'
import { useCategories } from '@/src/hooks/useCategories'
import { useScanBill } from '@/src/hooks/useScanBill'
import { useAddExpense } from '@/src/hooks/useExpenses'
import { categoryEmoji, splitEmoji } from '@/src/lib/emoji'
import { formatINR, formatDate } from '@/src/lib/format'
import { computeShare, feeDiff, groupByDivisor, round2, type ScanItem } from '@/src/lib/split'
import { todayIST } from '@/src/lib/date'
import { LoadingCaption } from '@/src/components/shared/LoadingCaption'
import { BottomSheet } from '@/src/components/shared/Modal'
import { Card } from '@/src/components/ui/Card'
import { Chip } from '@/src/components/ui/Chip'
import { DatePicker } from '@/src/components/shared/DatePicker'
import type { ScanResult } from '@/src/api/scan'

type ReviewItem = ScanItem & { key: string; name: string }

type Phase = 'picking' | 'scanning' | 'review' | 'confirm' | 'error'

const DIVISORS = [1, 2, 3, 4]
const PEOPLE_COUNTS = [2, 3, 4, 5]

let nextKey = 0
function makeKey(): string {
  nextKey += 1
  return String(nextKey)
}

function itemsFrom(result: ScanResult): ReviewItem[] {
  return result.items.map((it) => ({ key: makeKey(), name: it.name, price: it.price, divisor: 1 }))
}

/** mine -> ÷2 -> ÷3 -> ÷4 -> skip -> mine. A custom divisor (set via the ÷n sheet) falls back into the same cycle from wherever it sits numerically. */
function cycleDivisor(current: number | null): number | null {
  if (current === null) return 1
  if (current < 4) return current + 1
  return null
}

function splitLabel(divisor: number | null): string {
  if (divisor === null) return 'skip'
  if (divisor === 1) return 'mine'
  return `÷${divisor}`
}

/**
 * Pick a Blinkit/Instamart cart screenshot or a restaurant-bill photo, let
 * Gemini extract merchant/total/items, then review + split before logging one
 * ordinary expense through the same useAddExpense path log-expense uses.
 *
 * Phases: 'picking' (source bottom sheet), 'scanning' (loading caption),
 * 'review' (editable line items + split + fee/people card), 'confirm' (a
 * read-only breakdown before logging), 'error' (scan failed, escape hatch to
 * a blank manual entry). Only the computed share, merchant, category and date
 * become the expense — line items and the fee split never leave this screen.
 */
export default function ScanBillScreen() {
  const { tokens, space, radius, type } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const categoriesQ = useCategories()
  const categories = useMemo(() => categoriesQ.data ?? [], [categoriesQ.data])
  const scanBill = useScanBill()
  const addExpense = useAddExpense()

  const [phase, setPhase] = useState<Phase>('picking')
  const [errorMsg, setErrorMsg] = useState('')

  const [merchant, setMerchant] = useState('')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState(todayIST())
  const [items, setItems] = useState<ReviewItem[]>([])
  const [feeAmount, setFeeAmount] = useState(0)
  const [peopleCount, setPeopleCount] = useState(2)
  const [query, setQuery] = useState('')
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [divisorSheetKey, setDivisorSheetKey] = useState<string | null>(null)
  const [divisorText, setDivisorText] = useState('')

  const selectedCategory = categories.find((c) => c.name === category)
  const hasFee = Math.abs(feeAmount) >= 0.01
  const feeShare = hasFee ? round2(feeAmount / peopleCount) : 0
  const billTotal = useMemo(() => round2(items.reduce((s, it) => s + it.price, 0) + feeAmount), [items, feeAmount])
  const myShare = useMemo(() => round2(computeShare(items) + feeShare), [items, feeShare])
  const sharePct = billTotal > 0 ? Math.round((myShare / billTotal) * 100) : 0
  const buckets = useMemo(() => groupByDivisor(items), [items])
  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? items.filter((it) => it.name.toLowerCase().includes(q)) : items
  }, [items, query])
  const canProceed = merchant.trim() !== '' && category !== '' && myShare > 0 && !addExpense.isPending

  function updateItem(key: string, patch: Partial<ReviewItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)))
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it.key !== key))
  }

  function addBlankItem() {
    setItems((prev) => [...prev, { key: makeKey(), name: '', price: 0, divisor: 1 }])
  }

  function toggleSelecting() {
    setSelecting((prev) => !prev)
    setSelected([])
  }

  function toggleSelected(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  function applyBulkDivisor(divisor: number) {
    if (selected.length === 0) return
    setItems((prev) => prev.map((it) => (selected.includes(it.key) ? { ...it, divisor } : it)))
    setSelected([])
    setSelecting(false)
  }

  function setAllMine() {
    setItems((prev) => prev.map((it) => ({ ...it, divisor: 1 })))
  }

  async function pickFrom(source: 'camera' | 'library') {
    Haptics.selectionAsync().catch(() => {})
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      setErrorMsg('Camera/photo access is off — enable it in Settings, or enter this expense manually.')
      setPhase('error')
      return
    }

    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.5, base64: true }
    const result =
      source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options)

    if (result.canceled || !result.assets?.[0]) {
      router.back()
      return
    }

    const asset = result.assets[0]
    if (!asset.base64) {
      setErrorMsg("Couldn't read that image — try again or enter this expense manually.")
      setPhase('error')
      return
    }
    // The scan route always requires a non-empty category list — guards the
    // case where categories are still loading (or there simply are none yet)
    // at the moment the picker resolves, rather than sending Gemini an empty
    // enum constraint and getting back a 400.
    if (categories.length === 0) {
      setErrorMsg('No categories to sort this into yet — add one first, or enter this expense manually.')
      setPhase('error')
      return
    }

    setPhase('scanning')
    scanBill.mutate(
      {
        image: asset.base64,
        mimeType: asset.mimeType ?? 'image/jpeg',
        categories: categories.map((c) => c.name),
      },
      {
        onSuccess: (res) => {
          setMerchant(res.merchant)
          setCategory(res.category ?? '')
          setDate(res.date ?? todayIST())
          setItems(itemsFrom(res))
          setFeeAmount(feeDiff(res.total, res.items))
          setPeopleCount(2)
          setQuery('')
          setSelecting(false)
          setSelected([])
          setPhase('review')
        },
        onError: () => {
          setErrorMsg("Couldn't read that bill — try a clearer photo, or enter this expense manually.")
          setPhase('error')
        },
      },
    )
  }

  function handleConfirm() {
    if (addExpense.isPending) return
    addExpense.mutate(
      { item: merchant.trim(), amount_inr: String(myShare), category, date, payment_method: 'bank' },
      {
        onSuccess: (res) =>
          router.replace({
            pathname: '/modals/expense-added',
            params: {
              id: res.id ?? '',
              timestamp: res.timestamp ?? '',
              loggedAt: new Date().toISOString(),
              item: merchant.trim(),
              amount: String(myShare),
              category,
              date,
              notes: '',
              paymentMethod: 'bank',
            },
          }),
        onError: () =>
          router.replace({
            pathname: '/modals/expense-failed',
            params: { item: merchant.trim(), amount: String(myShare), category, date, notes: '', paymentMethod: 'bank' },
          }),
      },
    )
  }

  const divisorSheetItem = items.find((it) => it.key === divisorSheetKey)
  const categoryLabel = category ? splitEmoji(category).text : ''

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      {phase === 'confirm' ? (
        <ScreenHeader onLeft={() => setPhase('review')} leftIcon={ArrowLeft} title="Confirm your log" />
      ) : phase === 'review' ? (
        <ScreenHeader
          onLeft={() => router.back()}
          leftIcon={X}
          title="Scan a bill"
          subtitle={`${items.length} ${items.length === 1 ? 'item' : 'items'} · scanned just now`}
          right={
            <Pressable
              onPress={toggleSelecting}
              style={[
                styles.selectToggle,
                {
                  borderRadius: radius.full,
                  borderColor: selecting ? tokens.accentInk : tokens.border,
                  backgroundColor: selecting ? tokens.accentSoft : tokens.inputBg,
                },
              ]}
            >
              <Text style={{ color: selecting ? tokens.accentInk : tokens.text2, fontFamily: fontFamily.bodyBold, fontSize: type.caption }}>
                {selecting ? 'Done' : 'Select'}
              </Text>
            </Pressable>
          }
        />
      ) : (
        <ScreenHeader onLeft={() => router.back()} leftIcon={X} title="Scan a bill" />
      )}

      {phase === 'scanning' && (
        <View style={styles.centerFill}>
          <LoadingCaption phrases={['Reading the bill…', 'Finding the total…', 'Spotting line items…', 'Almost done…']} />
        </View>
      )}

      {phase === 'error' && (
        <View style={[styles.centerFill, { paddingHorizontal: space.lg, gap: space.lg }]}>
          <Text style={{ color: tokens.text2, fontFamily: fontFamily.bodyMedium, fontSize: type.body, textAlign: 'center' }}>
            {errorMsg}
          </Text>
          <Pressable
            onPress={() => router.replace('/modals/log-expense')}
            style={[styles.confirm, { backgroundColor: tokens.accent, borderRadius: radius.full, paddingVertical: space.md }]}
          >
            <Text style={{ color: tokens.onAccent, fontFamily: fontFamily.bodyBold, fontSize: type.bodyLg }}>Enter manually</Text>
          </Pressable>
        </View>
      )}

      {phase === 'review' && (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.body, { paddingHorizontal: space.lg, gap: space.md }]}
            keyboardShouldPersistTaps="handled"
          >
            <Card elevated={false} style={{ gap: space.xs }}>
              <Text style={[styles.microLabel, { color: tokens.text3 }]}>YOUR SHARE</Text>
              <Text style={{ color: tokens.accentInk, fontFamily: fontFamily.displaySemiBold, fontSize: type.display }}>
                {formatINR(myShare)}
              </Text>
              <View style={styles.spaceBetween}>
                <View style={[styles.barTrack, { flex: 1, backgroundColor: tokens.borderStrong }]}>
                  <View style={[styles.barFill, { width: `${Math.min(100, sharePct)}%`, backgroundColor: tokens.accent }]} />
                </View>
              </View>
              <View style={styles.spaceBetween}>
                <Text style={{ color: tokens.text3, fontFamily: fontFamily.bodySemiBold, fontSize: type.caption }}>
                  of {formatINR(billTotal)} bill
                </Text>
                <Text style={{ color: tokens.text3, fontFamily: fontFamily.bodyBold, fontSize: type.caption }}>{sharePct}% yours</Text>
              </View>
            </Card>

            <View style={[styles.row, { gap: space.sm }]}>
              <View style={[styles.searchRow, { flex: 1, gap: space.sm, backgroundColor: tokens.inputBg, borderColor: tokens.border }]}>
                <Search size={16} color={tokens.text3} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search items"
                  placeholderTextColor={tokens.text3}
                  style={[styles.searchInput, { color: tokens.text, fontFamily: fontFamily.bodyMedium, fontSize: type.body }]}
                />
                {query.length > 0 && (
                  <Pressable onPress={() => setQuery('')} style={[styles.clearButton, { backgroundColor: tokens.border }]}>
                    <Text style={{ color: tokens.text2, fontSize: 11 }}>✕</Text>
                  </Pressable>
                )}
              </View>
              <Pressable
                onPress={setAllMine}
                style={[styles.allMineButton, { backgroundColor: tokens.inputBg, borderColor: tokens.border, borderRadius: radius.md }]}
              >
                <Text style={{ color: tokens.text2, fontFamily: fontFamily.bodyBold, fontSize: type.caption }}>All mine</Text>
              </Pressable>
            </View>

            {visibleItems.length === 0 && items.length > 0 && (
              <Text style={{ color: tokens.text3, fontFamily: fontFamily.bodyMedium, fontSize: type.body, textAlign: 'center', paddingVertical: space.lg }}>
                No items match &quot;{query}&quot;
              </Text>
            )}

            {visibleItems.map((it) => {
              const isSelected = selected.includes(it.key)
              return (
                <View key={it.key} style={[styles.itemCard, { gap: space.sm, backgroundColor: tokens.card, borderRadius: radius.md }]}>
                  {selecting ? (
                    <Pressable onPress={() => toggleSelected(it.key)} style={[styles.row, { gap: space.sm }]}>
                      <View
                        style={[
                          styles.checkbox,
                          {
                            borderRadius: radius.sm,
                            borderColor: isSelected ? tokens.accentInk : tokens.border,
                            backgroundColor: isSelected ? tokens.accentInk : 'transparent',
                          },
                        ]}
                      >
                        {isSelected && <Check size={13} color={tokens.onAccent} strokeWidth={3} />}
                      </View>
                      <Text style={{ flex: 1, color: tokens.text, fontFamily: fontFamily.bodyBold, fontSize: type.body }} numberOfLines={1}>
                        {it.name || 'Item'}
                      </Text>
                      <Text style={{ color: tokens.text2, fontFamily: fontFamily.bodySemiBold, fontSize: type.body }}>{formatINR(it.price)}</Text>
                    </Pressable>
                  ) : (
                    <>
                      <View style={[styles.row, { gap: space.sm }]}>
                        <TextInput
                          value={it.name}
                          onChangeText={(v) => updateItem(it.key, { name: v })}
                          placeholder="Item"
                          placeholderTextColor={tokens.text3}
                          style={[
                            styles.nameInput,
                            { backgroundColor: tokens.inputBg, borderRadius: radius.md, color: tokens.text, fontFamily: fontFamily.bodyMedium, fontSize: type.body },
                          ]}
                        />
                        <TextInput
                          value={String(it.price)}
                          onChangeText={(v) => updateItem(it.key, { price: Number(v.replace(/[^0-9.]/g, '')) || 0 })}
                          keyboardType="decimal-pad"
                          style={[
                            styles.priceInput,
                            { backgroundColor: tokens.inputBg, borderRadius: radius.md, color: tokens.text, fontFamily: fontFamily.bodyMedium, fontSize: type.body },
                          ]}
                        />
                      </View>
                      <View style={[styles.row, { gap: space.sm }]}>
                        <Pressable
                          onPress={() => updateItem(it.key, { divisor: cycleDivisor(it.divisor) })}
                          onLongPress={() => {
                            setDivisorText(it.divisor && it.divisor > 1 ? String(it.divisor) : '')
                            setDivisorSheetKey(it.key)
                          }}
                          style={[styles.splitPill, { backgroundColor: tokens.pillBg, borderRadius: radius.full }]}
                        >
                          <Text style={{ color: tokens.text, fontFamily: fontFamily.bodySemiBold, fontSize: type.caption }}>
                            {splitLabel(it.divisor)}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => removeItem(it.key)}
                          hitSlop={8}
                          style={styles.deleteButton}
                          accessibilityLabel={`Remove ${it.name || 'item'}`}
                        >
                          <Trash2 size={16} color={tokens.text3} />
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              )
            })}

            <Pressable onPress={addBlankItem} style={[styles.addItem, { paddingVertical: space.sm }]}>
              <Plus size={16} color={tokens.accent} />
              <Text style={{ color: tokens.accent, fontFamily: fontFamily.bodySemiBold, fontSize: type.body }}>Add item</Text>
            </Pressable>

            {hasFee && (
              <Card elevated={false} style={{ gap: space.sm }}>
                <View style={styles.spaceBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: tokens.text, fontFamily: fontFamily.displaySemiBold, fontSize: type.body }}>Fees &amp; discount</Text>
                    <Text style={{ color: tokens.text3, fontFamily: fontFamily.bodySemiBold, fontSize: type.caption }}>
                      Split equally across everyone on the bill
                    </Text>
                  </View>
                  <Text style={{ color: tokens.text2, fontFamily: fontFamily.bodySemiBold, fontSize: type.body }}>{formatINR(feeAmount)}</Text>
                </View>
                <View style={styles.spaceBetween}>
                  <Text style={{ color: tokens.text2, fontFamily: fontFamily.bodyBold, fontSize: type.caption }}>People on this bill</Text>
                  <View style={{ flexDirection: 'row', gap: space.xs }}>
                    {PEOPLE_COUNTS.map((n) => (
                      <Chip key={n} label={String(n)} selected={peopleCount === n} onPress={() => setPeopleCount(n)} />
                    ))}
                  </View>
                </View>
                <View style={styles.spaceBetween}>
                  <Text style={{ color: tokens.text2, fontFamily: fontFamily.bodyBold, fontSize: type.caption }}>Your reconciled share</Text>
                  <Text style={{ color: tokens.accentInk, fontFamily: fontFamily.bodyBold, fontSize: type.caption }}>{formatINR(feeShare)}</Text>
                </View>
              </Card>
            )}

            <View style={[styles.divider, { backgroundColor: tokens.border }]} />

            <TextInput
              value={merchant}
              onChangeText={setMerchant}
              placeholder="Merchant"
              placeholderTextColor={tokens.text3}
              style={[
                styles.nameInput,
                { backgroundColor: tokens.inputBg, borderRadius: radius.md, color: tokens.text, fontFamily: fontFamily.bodyMedium, fontSize: type.body },
              ]}
            />

            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Pressable
                onPress={() => setCategoryPickerOpen(true)}
                style={[styles.categoryPill, { backgroundColor: tokens.pillBg, borderRadius: radius.full }]}
              >
                <Text numberOfLines={1} style={{ color: tokens.text, fontFamily: fontFamily.bodySemiBold, fontSize: type.caption }}>
                  {selectedCategory ? `${categoryEmoji(selectedCategory.name, selectedCategory.group)} ${splitEmoji(selectedCategory.name).text}` : 'Category'}
                </Text>
              </Pressable>
              <View style={{ flex: 1 }}>
                <DatePicker mode="single" value={date} onChange={setDate} />
              </View>
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingHorizontal: space.lg, paddingBottom: NAV_HEIGHT + insets.bottom + space.xxl, gap: space.sm }]}>
            {selecting && (
              <View style={[styles.bulkBar, { gap: space.sm, backgroundColor: tokens.card, borderRadius: radius.md }]}>
                <View style={styles.spaceBetween}>
                  <Text style={{ color: tokens.text, fontFamily: fontFamily.bodyBold, fontSize: type.caption }}>
                    {selected.length === 0 ? 'Tap rows to select' : `${selected.length} selected · set split to`}
                  </Text>
                  <Pressable onPress={() => setSelected([])}>
                    <Text style={{ color: tokens.text3, fontFamily: fontFamily.bodyBold, fontSize: type.caption }}>Clear</Text>
                  </Pressable>
                </View>
                <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' }}>
                  {DIVISORS.map((d) => (
                    <Chip key={d} label={splitLabel(d)} onPress={() => applyBulkDivisor(d)} />
                  ))}
                </View>
              </View>
            )}
            <Pressable
              onPress={() => canProceed && setPhase('confirm')}
              disabled={!canProceed}
              style={[styles.confirm, { backgroundColor: tokens.accent, borderRadius: radius.full, paddingVertical: space.md + 2, opacity: canProceed ? 1 : 0.5 }]}
            >
              <Text style={{ color: tokens.onAccent, fontFamily: fontFamily.bodyBold, fontSize: type.bodyLg }}>Review {formatINR(myShare)} →</Text>
            </Pressable>
          </View>

          <BottomSheet visible={categoryPickerOpen} onClose={() => setCategoryPickerOpen(false)}>
            <Text style={[styles.sheetTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold, fontSize: type.bodyLg }]}>
              Choose a category
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {categories.map((c) => (
                <Chip
                  key={c.name}
                  selected={category === c.name}
                  label={`${categoryEmoji(c.name, c.group)} ${splitEmoji(c.name).text}`}
                  onPress={() => {
                    setCategory(c.name)
                    setCategoryPickerOpen(false)
                  }}
                />
              ))}
            </View>
          </BottomSheet>

          <BottomSheet visible={divisorSheetKey !== null} onClose={() => setDivisorSheetKey(null)}>
            <Text style={[styles.sheetTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold, fontSize: type.bodyLg }]}>
              Split {divisorSheetItem?.name || 'item'} between how many?
            </Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <TextInput
                value={divisorText}
                onChangeText={setDivisorText}
                keyboardType="number-pad"
                placeholder="e.g. 5"
                placeholderTextColor={tokens.text3}
                autoFocus
                style={[
                  styles.nameInput,
                  { flex: 1, backgroundColor: tokens.inputBg, borderRadius: radius.md, color: tokens.text, fontFamily: fontFamily.bodyMedium, fontSize: type.body },
                ]}
              />
              <Pressable
                onPress={() => {
                  const n = Math.max(1, Math.round(Number(divisorText)) || 1)
                  if (divisorSheetKey) updateItem(divisorSheetKey, { divisor: n })
                  setDivisorSheetKey(null)
                }}
                style={[styles.confirm, { backgroundColor: tokens.accentInk, borderRadius: radius.md, paddingHorizontal: space.lg, justifyContent: 'center' }]}
              >
                <Text style={{ color: tokens.onAccent, fontFamily: fontFamily.bodySemiBold, fontSize: type.body }}>Set</Text>
              </Pressable>
            </View>
          </BottomSheet>
        </>
      )}

      {phase === 'confirm' && (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.body, { paddingHorizontal: space.lg, gap: space.lg }]}
          >
            <Card elevated={false} style={{ alignItems: 'center', gap: space.xs }}>
              <Text style={[styles.microLabel, { color: tokens.text3 }]}>LOGGING TO {categoryLabel.toUpperCase()}</Text>
              <Text style={{ color: tokens.accentInk, fontFamily: fontFamily.displaySemiBold, fontSize: type.hero }}>
                {formatINR(myShare)}
              </Text>
              <Text style={{ color: tokens.text3, fontFamily: fontFamily.bodySemiBold, fontSize: type.caption, textAlign: 'center' }}>
                {formatDate(date)} · from a scanned bill of {formatINR(billTotal)}
              </Text>
            </Card>

            <View style={{ gap: space.xs }}>
              <Text style={[styles.microLabel, { color: tokens.text3, paddingHorizontal: 4 }]}>WHERE IT CAME FROM</Text>
              <Card elevated={false} padded={false} style={{ overflow: 'hidden' }}>
                {buckets.map((b, i) => (
                  <View
                    key={b.divisor}
                    style={[
                      styles.bucketRow,
                      { gap: space.sm, padding: space.md, borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: tokens.border },
                    ]}
                  >
                    <View style={[styles.badge, { borderRadius: radius.sm, backgroundColor: b.divisor === 1 ? tokens.pillBg : tokens.accentSoft }]}>
                      <Text style={{ color: b.divisor === 1 ? tokens.text2 : tokens.accentInk, fontFamily: fontFamily.bodyBold, fontSize: type.caption }}>
                        {b.divisor === 1 ? '1' : `÷${b.divisor}`}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ color: tokens.text, fontFamily: fontFamily.bodyBold, fontSize: type.body }}>
                        {b.divisor === 1 ? 'Fully mine' : `Split ${b.divisor} ways`}
                      </Text>
                      <Text style={{ color: tokens.text3, fontFamily: fontFamily.bodySemiBold, fontSize: type.micro }}>
                        {b.count} {b.count === 1 ? 'item' : 'items'} · {b.divisor === 1 ? '100% yours' : `you pay 1/${b.divisor}`}
                      </Text>
                      <View style={[styles.miniBarTrack, { backgroundColor: tokens.borderStrong }]}>
                        <View
                          style={[
                            styles.miniBarFill,
                            {
                              width: `${Math.max(3, Math.round((b.share / Math.max(1, myShare)) * 100))}%`,
                              backgroundColor: b.divisor === 1 ? tokens.text3 : tokens.accent,
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: tokens.text, fontFamily: fontFamily.bodySemiBold, fontSize: type.body }}>{formatINR(b.share)}</Text>
                      <Text style={{ color: tokens.text3, fontFamily: fontFamily.bodySemiBold, fontSize: type.micro }}>of {formatINR(b.gross)}</Text>
                    </View>
                  </View>
                ))}
                {hasFee && (
                  <View
                    style={[
                      styles.bucketRow,
                      { gap: space.sm, padding: space.md, borderTopWidth: buckets.length > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: tokens.border },
                    ]}
                  >
                    <View style={[styles.badge, { borderRadius: radius.sm, backgroundColor: tokens.accentSoft }]}>
                      <Text style={{ color: tokens.accentInk, fontFamily: fontFamily.bodyBold, fontSize: type.body }}>₹</Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ color: tokens.text, fontFamily: fontFamily.bodyBold, fontSize: type.body }}>Fees &amp; discount, reconciled</Text>
                      <Text style={{ color: tokens.text3, fontFamily: fontFamily.bodySemiBold, fontSize: type.micro }}>
                        {formatINR(feeAmount)} split equally across {peopleCount} people
                      </Text>
                    </View>
                    <Text style={{ color: tokens.text, fontFamily: fontFamily.bodySemiBold, fontSize: type.body }}>{formatINR(feeShare)}</Text>
                  </View>
                )}
              </Card>
            </View>

            <Card elevated={false} style={{ gap: space.sm }}>
              <View style={styles.spaceBetween}>
                <Text style={{ color: tokens.text2, fontFamily: fontFamily.bodyBold, fontSize: type.caption }}>Total bill</Text>
                <Text style={{ color: tokens.text, fontFamily: fontFamily.bodySemiBold, fontSize: type.body }}>{formatINR(billTotal)}</Text>
              </View>
              <View style={[styles.barTrack, { height: 8, backgroundColor: tokens.borderStrong }]}>
                <View style={[styles.barFill, { width: `${Math.min(100, sharePct)}%`, backgroundColor: tokens.accent }]} />
              </View>
              <View style={styles.spaceBetween}>
                <Text style={{ color: tokens.accentInk, fontFamily: fontFamily.bodyBold, fontSize: type.caption }}>
                  You {formatINR(myShare)} · {sharePct}%
                </Text>
                <Text style={{ color: tokens.text3, fontFamily: fontFamily.bodyBold, fontSize: type.caption }}>Others {formatINR(billTotal - myShare)}</Text>
              </View>
            </Card>
          </ScrollView>

          <View style={[styles.footer, { paddingHorizontal: space.lg, paddingBottom: NAV_HEIGHT + insets.bottom + space.xxl, gap: space.sm }]}>
            <Pressable
              onPress={handleConfirm}
              disabled={addExpense.isPending}
              style={[styles.confirm, { backgroundColor: tokens.accent, borderRadius: radius.full, paddingVertical: space.md + 2 }]}
            >
              <Text style={{ color: tokens.onAccent, fontFamily: fontFamily.bodyBold, fontSize: type.bodyLg }}>
                {addExpense.isPending ? 'Saving…' : `Log ${formatINR(myShare)} to ${categoryLabel}`}
              </Text>
            </Pressable>
            <Pressable onPress={() => setPhase('review')} style={styles.backToItems}>
              <Text style={{ color: tokens.text3, fontFamily: fontFamily.bodyBold, fontSize: type.caption }}>Back to items</Text>
            </Pressable>
          </View>
        </>
      )}

      <BottomSheet visible={phase === 'picking'} onClose={() => router.back()}>
        <Text style={[styles.sheetTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold, fontSize: type.bodyLg }]}>
          Scan a bill
        </Text>
        <View style={{ gap: space.sm }}>
          <Pressable
            onPress={() => pickFrom('camera')}
            style={[styles.sourceRow, { gap: space.sm, backgroundColor: tokens.inputBg, borderRadius: radius.md, padding: space.md }]}
          >
            <Camera size={20} color={tokens.text} />
            <Text style={{ color: tokens.text, fontFamily: fontFamily.bodySemiBold, fontSize: type.body }}>Take a photo</Text>
          </Pressable>
          <Pressable
            onPress={() => pickFrom('library')}
            style={[styles.sourceRow, { gap: space.sm, backgroundColor: tokens.inputBg, borderRadius: radius.md, padding: space.md }]}
          >
            <Images size={20} color={tokens.text} />
            <Text style={{ color: tokens.text, fontFamily: fontFamily.bodySemiBold, fontSize: type.body }}>Choose a screenshot</Text>
          </Pressable>
        </View>
      </BottomSheet>
    </View>
  )
}

function ScreenHeader({
  onLeft,
  leftIcon: LeftIcon,
  title,
  subtitle,
  right,
}: {
  onLeft: () => void
  leftIcon: LucideIcon
  title: string
  subtitle?: string
  right?: ReactNode
}) {
  const { tokens, space, type } = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.header, { paddingTop: insets.top + space.sm, paddingHorizontal: space.lg, gap: space.sm }]}>
      <Pressable onPress={onLeft} hitSlop={12} accessibilityLabel="Close">
        <LeftIcon size={22} color={tokens.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={[styles.headerTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold, fontSize: type.bodyLg }]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={{ color: tokens.text3, fontFamily: fontFamily.bodySemiBold, fontSize: type.micro }}>{subtitle}</Text>
        )}
      </View>
      {right ?? <View style={{ width: 22 }} />}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  headerTitle: {},
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  body: { paddingTop: 8, paddingBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center' },
  spaceBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  microLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  barTrack: { height: 6, borderRadius: 999, overflow: 'hidden', width: '100%' },
  barFill: { height: '100%', borderRadius: 999 },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 40, borderRadius: 12, borderWidth: 1 },
  searchInput: { flex: 1, padding: 0 },
  clearButton: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  allMineButton: { paddingHorizontal: 14, justifyContent: 'center', height: 40 },
  itemCard: { padding: 12 },
  nameInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  priceInput: { width: 76, paddingHorizontal: 10, paddingVertical: 12, textAlign: 'right' },
  splitPill: { paddingHorizontal: 12, paddingVertical: 7, minWidth: 48, alignItems: 'center' },
  deleteButton: { marginLeft: 'auto', padding: 4 },
  checkbox: { width: 22, height: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  addItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  divider: { height: StyleSheet.hairlineWidth },
  categoryPill: { paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center' },
  footer: {},
  confirm: { alignItems: 'center' },
  backToItems: { alignItems: 'center', paddingVertical: 6 },
  bulkBar: { padding: 12 },
  sheetTitle: { marginBottom: 12 },
  sourceRow: { flexDirection: 'row', alignItems: 'center' },
  selectToggle: { height: 30, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  bucketRow: { flexDirection: 'row', alignItems: 'center' },
  badge: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  miniBarTrack: { height: 4, borderRadius: 999, overflow: 'hidden', marginTop: 2 },
  miniBarFill: { height: '100%', borderRadius: 999 },
})
