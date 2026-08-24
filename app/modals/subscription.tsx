import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { useAddSubscription, useSubscriptions, useUpdateSubscription } from '@/src/hooks/useSubscriptions'
import { CheckIcon } from '@/src/components/shared/CheckIcon'
import { DatePicker } from '@/src/components/shared/DatePicker'

const CYCLES = ['monthly', 'yearly', 'quarterly', 'weekly', 'one-time']

function str(v: string | string[] | undefined): string {
  return typeof v === 'string' ? v : ''
}

// Route-param driven per holding-action.tsx's pattern: {service} → edit mode, no params → add.
export default function SubscriptionModal() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const params = useLocalSearchParams()
  const origService = str(params.service)
  const isEdit = origService !== ''

  const subsQ = useSubscriptions()
  const addSub = useAddSubscription()
  const updateSub = useUpdateSubscription()
  const existing = subsQ.data?.find((s) => s.service === origService)

  const [service, setService] = useState(existing?.service ?? '')
  const [amount, setAmount] = useState(existing?.amount_inr ?? '')
  const [cycle, setCycle] = useState(existing?.billing_cycle || 'monthly')
  const [nextDueDate, setNextDueDate] = useState(existing?.next_due_date ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [saved, setSaved] = useState(false)

  // existing loads async on first mount (query cache may be cold) — backfill once it arrives.
  useEffect(() => {
    if (!existing) return
    setService(existing.service)
    setAmount(existing.amount_inr)
    setCycle(existing.billing_cycle || 'monthly')
    setNextDueDate(existing.next_due_date ?? '')
    setNotes(existing.notes ?? '')
  }, [existing])

  const parsedAmount = Number(amount)
  const canSubmit = service.trim() !== '' && amount.trim() !== '' && !Number.isNaN(parsedAmount) && parsedAmount >= 0
  const saving = addSub.isPending || updateSub.isPending

  useEffect(() => {
    if (!saved) return
    const timer = setTimeout(() => router.back(), 1100)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved])

  function handleSubmit() {
    if (!canSubmit) return
    if (isEdit) {
      updateSub.mutate(
        {
          service: origService,
          updates: {
            new_service: service.trim(),
            amount_inr: String(parsedAmount),
            billing_cycle: cycle,
            next_due_date: nextDueDate.trim(),
            notes: notes.trim(),
          },
        },
        { onSuccess: () => setSaved(true) },
      )
    } else {
      addSub.mutate(
        {
          service: service.trim(),
          amount_inr: String(parsedAmount),
          billing_cycle: cycle,
          next_due_date: nextDueDate.trim(),
          notes: notes.trim(),
        },
        { onSuccess: () => setSaved(true) },
      )
    }
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
          {isEdit ? 'Edit subscription' : 'Add subscription'}
        </Text>
        <View style={{ width: 52 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>Service</Text>
          <TextInput
            value={service}
            onChangeText={setService}
            placeholder="e.g. Netflix"
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
          <Text style={[styles.fieldLabel, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>Billing cycle</Text>
          <View style={styles.chipRow}>
            {CYCLES.map((c) => {
              const selected = cycle === c
              return (
                <Pressable
                  key={c}
                  onPress={() => setCycle(c)}
                  style={[styles.chip, { backgroundColor: selected ? tokens.gold : tokens.pillBg, borderColor: selected ? tokens.gold : tokens.border }]}
                >
                  <Text style={[styles.chipText, { color: selected ? tokens.onAccent : tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>
                    {c}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>Next due date</Text>
          <DatePicker mode="single" value={nextDueDate} onChange={setNextDueDate} disableFuture={false} />
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

        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit || saving || saved}
          style={[styles.confirmButton, { backgroundColor: saved ? tokens.mint : tokens.gold, opacity: !canSubmit || saving ? 0.5 : 1 }]}
        >
          {saved ? (
            <CheckIcon color={tokens.onAccent} />
          ) : (
            <Text style={[styles.confirmText, { color: tokens.onAccent, fontFamily: fontFamily.bodyBold }]}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add subscription'}
            </Text>
          )}
        </Pressable>
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
  currency: { fontSize: 18 },
  amountInput: { flex: 1, fontSize: 18, paddingVertical: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13 },
  confirmButton: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  confirmText: { fontSize: 16 },
})
