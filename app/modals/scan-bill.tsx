import { useMemo, useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import * as Haptics from 'expo-haptics'
import { X, Camera, Images, Plus, Trash2 } from 'lucide-react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { NAV_HEIGHT } from '@/src/theme/scale'
import { useCategories } from '@/src/hooks/useCategories'
import { useScanBill } from '@/src/hooks/useScanBill'
import { useAddExpense } from '@/src/hooks/useExpenses'
import { categoryEmoji, splitEmoji } from '@/src/lib/emoji'
import { formatINR } from '@/src/lib/format'
import { computeShare, reconcile, type ScanItem } from '@/src/lib/split'
import { todayIST } from '@/src/lib/date'
import { LoadingCaption } from '@/src/components/shared/LoadingCaption'
import { BottomSheet } from '@/src/components/shared/Modal'
import { Chip } from '@/src/components/ui/Chip'
import { DatePicker } from '@/src/components/shared/DatePicker'
import type { ScanResult } from '@/src/api/scan'

type ReviewItem = ScanItem & { key: string; name: string }

type Phase = 'picking' | 'scanning' | 'review' | 'error'

let nextKey = 0
function makeKey(): string {
  nextKey += 1
  return String(nextKey)
}

function reviewItemsFrom(result: ScanResult): ReviewItem[] {
  const withFees = reconcile(
    result.total,
    result.items.map((i) => ({ name: i.name, price: i.price })),
  )
  return withFees.map((it) => ({ key: makeKey(), name: it.name, price: it.price, divisor: 1 }))
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
 * One screen, four phases: 'picking' (source bottom sheet), 'scanning'
 * (loading caption), 'review' (editable line items + split), 'error' (scan
 * failed, escape hatch to a blank manual entry). Confirm drops the line items
 * — only the computed share, merchant, category and date become the expense.
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
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [divisorSheetKey, setDivisorSheetKey] = useState<string | null>(null)
  const [divisorText, setDivisorText] = useState('')

  const selectedCategory = categories.find((c) => c.name === category)
  const myShare = useMemo(() => computeShare(items), [items])
  const canConfirm = merchant.trim() !== '' && category !== '' && myShare > 0 && !addExpense.isPending

  function updateItem(key: string, patch: Partial<ReviewItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)))
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it.key !== key))
  }

  function addBlankItem() {
    setItems((prev) => [...prev, { key: makeKey(), name: '', price: 0, divisor: 1 }])
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
          setItems(reviewItemsFrom(res))
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
    if (!canConfirm) return
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

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm, paddingHorizontal: space.lg }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
          <X size={24} color={tokens.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold, fontSize: type.bodyLg }]}>
          Scan a bill
        </Text>
        <View style={{ width: 24 }} />
      </View>

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
            contentContainerStyle={[styles.body, { paddingHorizontal: space.lg, gap: space.sm }]}
            keyboardShouldPersistTaps="handled"
          >
            {items.map((it) => (
              <View key={it.key} style={[styles.row, { gap: space.sm }]}>
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
                <Pressable onPress={() => removeItem(it.key)} hitSlop={8} accessibilityLabel={`Remove ${it.name || 'item'}`}>
                  <Trash2 size={18} color={tokens.text3} />
                </Pressable>
              </View>
            ))}

            <Pressable onPress={addBlankItem} style={[styles.addItem, { paddingVertical: space.sm }]}>
              <Plus size={16} color={tokens.accent} />
              <Text style={{ color: tokens.accent, fontFamily: fontFamily.bodySemiBold, fontSize: type.body }}>Add item</Text>
            </Pressable>

            <View style={[styles.divider, { backgroundColor: tokens.border }]} />

            <View style={[styles.totalRow]}>
              <Text style={{ color: tokens.text, fontFamily: fontFamily.bodyBold, fontSize: type.body }}>My share</Text>
              <Text style={{ color: tokens.text, fontFamily: fontFamily.displaySemiBold, fontSize: type.bodyLg }}>
                {formatINR(myShare)}
              </Text>
            </View>

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

          <View style={[styles.footer, { paddingHorizontal: space.lg, paddingBottom: NAV_HEIGHT + insets.bottom + space.xxl }]}>
            <Pressable
              onPress={handleConfirm}
              disabled={!canConfirm}
              style={[
                styles.confirm,
                { backgroundColor: tokens.accent, borderRadius: radius.full, paddingVertical: space.md + 2, opacity: canConfirm ? 1 : 0.5 },
              ]}
            >
              <Text style={{ color: tokens.onAccent, fontFamily: fontFamily.bodyBold, fontSize: type.bodyLg }}>
                {addExpense.isPending ? 'Saving…' : 'Confirm'}
              </Text>
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

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 },
  headerTitle: {},
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  body: { paddingTop: 8, paddingBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center' },
  nameInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  priceInput: { width: 76, paddingHorizontal: 10, paddingVertical: 12, textAlign: 'right' },
  splitPill: { paddingHorizontal: 12, paddingVertical: 7, minWidth: 48, alignItems: 'center' },
  addItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  divider: { height: StyleSheet.hairlineWidth },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoryPill: { paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center' },
  footer: {},
  confirm: { alignItems: 'center' },
  sheetTitle: { marginBottom: 12 },
  sourceRow: { flexDirection: 'row', alignItems: 'center' },
})
