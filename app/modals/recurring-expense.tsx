import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Alert } from '@/src/components/ui/AlertHost'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import {
  useAddRecurringExpense,
  useDeleteRecurringExpense,
  usePauseRecurringExpense,
  useRecurringExpenses,
  useResumeRecurringExpense,
  useUpdateRecurringExpense,
} from '@/src/hooks/useRecurringExpenses'
import { CheckIcon } from '@/src/components/shared/CheckIcon'
import { DatePicker } from '@/src/components/shared/DatePicker'
import { BottomSheet } from '@/src/components/shared/Modal'
import { CategoryPickerSheet } from '@/src/components/shared/CategoryPickerSheet'
import { splitEmoji } from '@/src/lib/emoji'
import { todayIST } from '@/src/lib/date'

const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly']
const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'bank', label: 'Bank' },
  { value: 'credit_card', label: 'Credit card' },
]

function str(v: string | string[] | undefined): string {
  return typeof v === 'string' ? v : ''
}

// Route-param driven, same as subscription.tsx: {id} → edit mode, no params → add.
export default function RecurringExpenseModal() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const params = useLocalSearchParams()
  const id = str(params.id)
  const isEdit = id !== ''

  const recurringQ = useRecurringExpenses()
  const addRecurring = useAddRecurringExpense()
  const updateRecurring = useUpdateRecurringExpense()
  const pauseRecurring = usePauseRecurringExpense()
  const resumeRecurring = useResumeRecurringExpense()
  const deleteRecurring = useDeleteRecurringExpense()
  const existing = recurringQ.data?.find((r) => r.id === id)
  const isActive = existing ? existing.status === 'active' : true

  const [item, setItem] = useState(existing?.item ?? '')
  const [amount, setAmount] = useState(existing?.amount_inr ?? '')
  const [frequency, setFrequency] = useState(existing?.frequency || 'monthly')
  const [startDate, setStartDate] = useState(existing?.start_date || todayIST())
  const [endDate, setEndDate] = useState(existing?.end_date ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [category, setCategory] = useState(existing?.category ?? '')
  const [paymentMethod, setPaymentMethod] = useState(existing?.payment_method || 'bank')
  const [categorySheetOpen, setCategorySheetOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmSheet, setConfirmSheet] = useState<'delete' | null>(null)

  // existing loads async on first mount (query cache may be cold) — backfill once it arrives.
  useEffect(() => {
    if (!existing) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- backfilling an editable form once an async query result arrives, not derivable from render
    setItem(existing.item)
    setAmount(existing.amount_inr)
    setFrequency(existing.frequency || 'monthly')
    setStartDate(existing.start_date || todayIST())
    setEndDate(existing.end_date ?? '')
    setNotes(existing.notes ?? '')
    setCategory(existing.category ?? '')
    setPaymentMethod(existing.payment_method || 'bank')
  }, [existing])

  const parsedAmount = Number(amount)
  const datesValid = startDate !== '' && (endDate === '' || endDate >= startDate)
  const canSubmit =
    item.trim() !== '' &&
    amount.trim() !== '' &&
    !Number.isNaN(parsedAmount) &&
    parsedAmount > 0 &&
    category !== '' &&
    datesValid
  const saving = addRecurring.isPending || updateRecurring.isPending
  const mutatingAction = pauseRecurring.isPending || resumeRecurring.isPending || deleteRecurring.isPending

  useEffect(() => {
    if (!saved) return
    const timer = setTimeout(() => router.back(), 1100)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved])

  function handleSubmit() {
    if (!canSubmit) return
    const fields = {
      item: item.trim(),
      amount_inr: String(parsedAmount),
      category,
      frequency,
      start_date: startDate,
      end_date: endDate,
      notes: notes.trim(),
      payment_method: paymentMethod,
    }
    const onSuccess = () => setSaved(true)

    if (isEdit) {
      updateRecurring.mutate(
        { id, updates: fields },
        { onSuccess, onError: () => Alert.alert("Couldn't save", 'Check your connection and try again.') },
      )
    } else {
      addRecurring.mutate(fields, {
        onSuccess,
        onError: () => Alert.alert("Couldn't add this", 'Check your connection and try again.'),
      })
    }
  }

  function handleTogglePause() {
    const mutation = isActive ? pauseRecurring : resumeRecurring
    mutation.mutate(id, {
      onSuccess: () => setSaved(true),
      onError: () => Alert.alert("Couldn't update this", 'Check your connection and try again.'),
    })
  }

  function confirmDelete() {
    deleteRecurring.mutate(id, {
      onSuccess: () => {
        setConfirmSheet(null)
        setSaved(true)
      },
      onError: () => {
        setConfirmSheet(null)
        Alert.alert("Couldn't delete this", 'Check your connection and try again.')
      },
    })
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: tokens.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: tokens.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} disabled={saved}>
          <Text style={[styles.headerAction, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>
            Cancel
          </Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
          {isEdit ? 'Edit recurring' : 'New recurring'}
        </Text>
        <View style={{ width: 52 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>What is it</Text>
          <TextInput
            value={item}
            onChangeText={setItem}
            placeholder="e.g. Rent"
            placeholderTextColor={tokens.text3}
            style={[styles.input, { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text, fontFamily: fontFamily.bodyMedium }]}
            autoFocus={!isEdit}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>Amount (₹)</Text>
          <View style={[styles.inputRow, { backgroundColor: tokens.inputBg, borderColor: tokens.border }]}>
            <Text style={[styles.currency, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>₹</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={tokens.text3}
              style={[styles.amountInput, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>How often</Text>
          <View style={styles.chipRow}>
            {FREQUENCIES.map((f) => {
              const selected = frequency === f
              return (
                <Pressable
                  key={f}
                  onPress={() => setFrequency(f)}
                  style={[styles.chip, { backgroundColor: selected ? tokens.accent : tokens.pillBg, borderColor: selected ? tokens.accent : tokens.border }]}
                >
                  <Text style={[styles.chipText, { color: selected ? tokens.onAccent : tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>
                    {f}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>Starts</Text>
          <DatePicker mode="single" value={startDate} onChange={setStartDate} disableFuture={false} />
        </View>

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>Ends (optional)</Text>
          <DatePicker mode="single" value={endDate} onChange={setEndDate} disableFuture={false} />
          {endDate !== '' && endDate < startDate ? (
            <Text style={[styles.errorHint, { color: tokens.coral, fontFamily: fontFamily.bodyMedium }]}>
              The end date can&apos;t be before the start date.
            </Text>
          ) : (
            <Text style={[styles.hint, { color: tokens.text3, fontFamily: fontFamily.bodyMedium }]}>
              Leave this empty and it keeps going until you stop it.
            </Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>Paid with</Text>
          <View style={styles.chipRow}>
            {PAYMENT_METHODS.map((p) => {
              const selected = paymentMethod === p.value
              return (
                <Pressable
                  key={p.value}
                  onPress={() => setPaymentMethod(p.value)}
                  style={[styles.chip, { backgroundColor: selected ? tokens.accent : tokens.pillBg, borderColor: selected ? tokens.accent : tokens.border }]}
                >
                  <Text style={[styles.chipText, { color: selected ? tokens.onAccent : tokens.text2, fontFamily: fontFamily.bodySemiBold, textTransform: 'none' }]}>
                    {p.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>Notes (optional)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes"
            placeholderTextColor={tokens.text3}
            style={[styles.input, { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text, fontFamily: fontFamily.bodyMedium }]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>Category</Text>
          <Pressable
            onPress={() => setCategorySheetOpen(true)}
            style={[styles.input, { backgroundColor: tokens.inputBg, borderColor: tokens.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
          >
            <Text style={{ color: category ? tokens.text : tokens.text3, fontFamily: fontFamily.bodyMedium, fontSize: 15 }}>
              {category ? splitEmoji(category).text : 'Pick a category'}
            </Text>
          </Pressable>
          <Text style={[styles.hint, { color: tokens.text3, fontFamily: fontFamily.bodyMedium }]}>
            {category
              ? `We'll add this expense in ${splitEmoji(category).text} on every due date.`
              : 'Pick one so we know which envelope to file it under.'}
          </Text>
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit || saving || mutatingAction || saved}
          style={[styles.confirmButton, { backgroundColor: saved ? tokens.mint : tokens.accent, opacity: !canSubmit || saving || mutatingAction ? 0.5 : 1 }]}
        >
          {saved ? (
            <CheckIcon color={tokens.onAccent} />
          ) : (
            <Text style={[styles.confirmText, { color: tokens.onAccent, fontFamily: fontFamily.bodyBold }]}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add recurring expense'}
            </Text>
          )}
        </Pressable>

        {isEdit && existing && !saved ? (
          <View style={[styles.dangerZone, { borderTopColor: tokens.border }]}>
            <Pressable
              onPress={handleTogglePause}
              disabled={saving || mutatingAction}
              style={{ opacity: saving || mutatingAction ? 0.5 : 1 }}
            >
              <Text style={{ color: isActive ? tokens.coral : tokens.mint, fontSize: 14, fontFamily: fontFamily.bodySemiBold, textAlign: 'center' }}>
                {pauseRecurring.isPending || resumeRecurring.isPending
                  ? 'Working…'
                  : isActive
                    ? 'Pause this'
                    : 'Resume this'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setConfirmSheet('delete')}
              disabled={saving || mutatingAction}
              style={{ marginTop: 16, opacity: saving || mutatingAction ? 0.5 : 1 }}
            >
              <Text style={{ color: tokens.text3, fontSize: 13, fontFamily: fontFamily.bodySemiBold, textAlign: 'center' }}>
                Delete
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <CategoryPickerSheet
        visible={categorySheetOpen}
        onClose={() => setCategorySheetOpen(false)}
        value={category}
        onSelect={setCategory}
      />

      <BottomSheet visible={confirmSheet !== null} onClose={() => !mutatingAction && setConfirmSheet(null)}>
        <Text style={[styles.sheetTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
          Delete recurring expense
        </Text>
        <Text style={[styles.sheetBody, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
          {`Remove "${existing?.item ?? ''}"? Expenses already logged from it stay put.`}
        </Text>
        <View style={styles.sheetButtonRow}>
          <Pressable
            onPress={() => setConfirmSheet(null)}
            disabled={mutatingAction}
            style={[styles.sheetCancelButton, { backgroundColor: tokens.pillBg, opacity: mutatingAction ? 0.5 : 1 }]}
          >
            <Text style={[styles.sheetCancelText, { color: tokens.text2, fontFamily: fontFamily.bodyBold }]}>Back</Text>
          </Pressable>
          <Pressable
            onPress={confirmDelete}
            disabled={mutatingAction}
            style={[styles.sheetSaveButton, { backgroundColor: tokens.coral, opacity: mutatingAction ? 0.6 : 1 }]}
          >
            <Text style={[styles.sheetSaveText, { color: tokens.onAccent, fontFamily: fontFamily.bodyBold }]}>
              {mutatingAction ? 'Working…' : 'Delete'}
            </Text>
          </Pressable>
        </View>
      </BottomSheet>
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
  currency: { fontSize: 18 },
  amountInput: { flex: 1, fontSize: 18, paddingVertical: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13, textTransform: 'capitalize' },
  hint: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  errorHint: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  confirmButton: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  confirmText: { fontSize: 16 },
  dangerZone: { marginTop: 24, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth },
  sheetTitle: { fontSize: 18, marginBottom: 12 },
  sheetBody: { fontSize: 13, lineHeight: 18 },
  sheetButtonRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  sheetCancelButton: { flex: 1, minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  sheetCancelText: { fontSize: 14 },
  sheetSaveButton: { flex: 1, minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  sheetSaveText: { fontSize: 14 },
})
