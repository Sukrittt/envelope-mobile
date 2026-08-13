import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { useCategories } from '@/src/hooks/useCategories'
import { useCategoryMap } from '@/src/hooks/useCategoryMap'
import { useAddExpense, useUpdateExpense } from '@/src/hooks/useExpenses'
import { categoryEmoji, splitEmoji } from '@/src/lib/emoji'

const AnimatedPath = Animated.createAnimatedComponent(Path)

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function str(v: string | string[] | undefined): string {
  return typeof v === 'string' ? v : ''
}

// Subset of Web's autoCategory.ts::suggestCategory — matches item words against
// the category-map dictionary. Skips the fuzzy old-category-name fallback since
// that's for renamed-category migration, not relevant when logging a new expense.
function suggestCategory(item: string, words: Record<string, string>, categories: string[]): string {
  if (!item.trim()) return ''
  const matched = new Map<string, number>()
  for (const word of item.toLowerCase().split(/\s+/)) {
    if (word.length < 2) continue
    const cat = words[word]
    if (cat && categories.includes(cat)) matched.set(cat, (matched.get(cat) ?? 0) + 1)
  }
  let best = ''
  let bestScore = 0
  for (const [cat, score] of matched) {
    if (score > bestScore) {
      best = cat
      bestScore = score
    }
  }
  return best
}

// Route-param driven: Activity passes {timestamp, item, amountInr, category,
// date, notes, paymentMethod} of an existing row to enter edit mode (mirrors
// holding-action.tsx's param pattern). No params → fresh "log expense" form.
export default function LogExpenseModal() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const params = useLocalSearchParams()

  const origTimestamp = str(params.timestamp)
  const isEdit = origTimestamp !== ''
  const origItem = str(params.item)
  const origAmountInr = Number(params.amountInr) || 0

  const categoriesQ = useCategories()
  const categoryMapQ = useCategoryMap()
  const addExpense = useAddExpense()
  const updateExpense = useUpdateExpense()

  const categories = categoriesQ.data ?? []

  const [amount, setAmount] = useState(isEdit ? String(origAmountInr) : '')
  const [item, setItem] = useState(origItem)
  const [category, setCategory] = useState(str(params.category))
  const [categoryTouched, setCategoryTouched] = useState(str(params.category) !== '')
  const [date, setDate] = useState(str(params.date).slice(0, 10) || todayISO())
  const [notes, setNotes] = useState(str(params.notes))
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'credit_card'>(
    str(params.paymentMethod) === 'credit_card' ? 'credit_card' : 'bank',
  )
  const [error, setError] = useState('')
  const [logSuccess, setLogSuccess] = useState(false)
  const successScale = useRef(new Animated.Value(0.6)).current
  // Length of the "M5 13l4 4L19 7" checkmark path: sqrt(32) + sqrt(200) ≈ 19.8
  const CHECK_PATH_LENGTH = 19.8
  const checkDashoffset = useRef(new Animated.Value(CHECK_PATH_LENGTH)).current

  // Debounced auto-suggest while typing the description, only until the user
  // manually picks a category (so we never fight a deliberate choice).
  useEffect(() => {
    if (categoryTouched || !item.trim() || !categoryMapQ.data) return
    const timer = setTimeout(() => {
      const suggested = suggestCategory(item, categoryMapQ.data!.words, categories.map((c) => c.name))
      if (suggested) setCategory(suggested)
    }, 300)
    return () => clearTimeout(timer)
  }, [item, categoryMapQ.data, categories, categoryTouched])

  const parsedAmount = Number(amount)
  const canSubmit = item.trim() !== '' && category !== '' && !Number.isNaN(parsedAmount) && parsedAmount > 0
  const saving = addExpense.isPending || updateExpense.isPending

  function playSuccessAndClose() {
    successScale.setValue(0.6)
    checkDashoffset.setValue(CHECK_PATH_LENGTH)
    setLogSuccess(true)
    Animated.timing(successScale, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start()
    Animated.timing(checkDashoffset, {
      toValue: 0,
      duration: 350,
      delay: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start()
    setTimeout(() => router.back(), 1100)
  }

  function handleSubmit() {
    if (!canSubmit) return
    setError('')
    if (isEdit) {
      updateExpense.mutate(
        {
          timestamp: origTimestamp,
          item: origItem,
          amountInr: origAmountInr,
          updates: {
            new_item: item.trim(),
            new_amount_inr: String(parsedAmount),
            new_date: date,
            category,
          },
        },
        {
          onSuccess: () => router.back(),
          onError: (e) => setError(e instanceof Error ? e.message : 'Failed to save'),
        },
      )
    } else {
      addExpense.mutate(
        {
          item: item.trim(),
          amount_inr: String(parsedAmount),
          category,
          date,
          notes: notes.trim(),
          payment_method: paymentMethod,
        },
        {
          onSuccess: () => playSuccessAndClose(),
          onError: (e) => setError(e instanceof Error ? e.message : 'Failed to save'),
        },
      )
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: tokens.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: tokens.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} disabled={logSuccess}>
          <Text style={[styles.headerAction, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>
            Cancel
          </Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
          {isEdit ? 'Edit expense' : 'Log expense'}
        </Text>
        <View style={{ width: 52 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={[styles.inputRow, { backgroundColor: tokens.inputBg, borderColor: tokens.border }]}>
          <Text style={[styles.currency, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>₹</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={tokens.text3}
            style={[styles.amountInput, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}
            autoFocus={!isEdit}
          />
        </View>

        <TextInput
          value={item}
          onChangeText={setItem}
          placeholder="Description"
          placeholderTextColor={tokens.text3}
          style={[
            styles.input,
            { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text, fontFamily: fontFamily.bodyMedium },
          ]}
        />

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>Category</Text>
          <View style={styles.chipRow}>
            {categories.map((c) => {
              const selected = category === c.name
              return (
                <Pressable
                  key={c.name}
                  onPress={() => {
                    setCategory(c.name)
                    setCategoryTouched(true)
                  }}
                  style={[
                    styles.chip,
                    { backgroundColor: selected ? tokens.gold : tokens.pillBg, borderColor: selected ? tokens.gold : tokens.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: selected ? tokens.onAccent : tokens.text2, fontFamily: fontFamily.bodySemiBold },
                    ]}
                  >
                    {categoryEmoji(c.name, c.group)} {splitEmoji(c.name).text}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>Date</Text>
          <TextInput
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={tokens.text3}
            style={[
              styles.input,
              { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text, fontFamily: fontFamily.bodyMedium },
            ]}
          />
        </View>

        {!isEdit && (
          <>
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>
                Notes (optional)
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Notes"
                placeholderTextColor={tokens.text3}
                style={[
                  styles.input,
                  { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text, fontFamily: fontFamily.bodyMedium },
                ]}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>
                Payment method
              </Text>
              <View style={styles.payRow}>
                {(['bank', 'credit_card'] as const).map((m) => {
                  const selected = paymentMethod === m
                  return (
                    <Pressable
                      key={m}
                      onPress={() => setPaymentMethod(m)}
                      style={[
                        styles.payOption,
                        { backgroundColor: selected ? tokens.gold : tokens.pillBg, borderColor: selected ? tokens.gold : tokens.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: selected ? tokens.onAccent : tokens.text2, fontFamily: fontFamily.bodySemiBold },
                        ]}
                      >
                        {m === 'bank' ? 'Bank/UPI' : 'Credit Card'}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          </>
        )}

        {error !== '' && (
          <Text style={[styles.error, { color: tokens.coral, fontFamily: fontFamily.bodyMedium }]}>{error}</Text>
        )}

        {logSuccess ? (
          <Animated.View
            style={[
              styles.confirmButton,
              styles.successPill,
              { backgroundColor: tokens.mint, transform: [{ scale: successScale }] },
            ]}
          >
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <AnimatedPath
                d="M5 13l4 4L19 7"
                stroke={tokens.onAccent}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={[CHECK_PATH_LENGTH, CHECK_PATH_LENGTH]}
                strokeDashoffset={checkDashoffset}
              />
            </Svg>
          </Animated.View>
        ) : (
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit || saving}
            style={[styles.confirmButton, { backgroundColor: tokens.gold, opacity: !canSubmit || saving ? 0.5 : 1 }]}
          >
            <Text style={[styles.confirmText, { color: tokens.onAccent, fontFamily: fontFamily.bodyBold }]}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add transaction'}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerAction: { fontSize: 14, width: 52 },
  headerTitle: { fontSize: 16 },
  body: { padding: 20, gap: 16 },
  field: { gap: 8 },
  fieldLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, gap: 6 },
  currency: { fontSize: 20 },
  amountInput: { flex: 1, fontSize: 20, paddingVertical: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: 13 },
  payRow: { flexDirection: 'row', gap: 8 },
  payOption: { flex: 1, borderWidth: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  error: { fontSize: 12 },
  confirmButton: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  confirmText: { fontSize: 16 },
  successPill: { justifyContent: 'center' },
})
