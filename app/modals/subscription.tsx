import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, Alert, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import {
  useAddSubscription,
  useCancelSubscription,
  useDeleteSubscription,
  useReactivateSubscription,
  useSubscriptions,
  useUpdateSubscription,
} from '@/src/hooks/useSubscriptions'
import { CheckIcon } from '@/src/components/shared/CheckIcon'
import { DatePicker } from '@/src/components/shared/DatePicker'
import { BottomSheet } from '@/src/components/shared/Modal'

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
  const cancelSub = useCancelSubscription()
  const reactivateSub = useReactivateSubscription()
  const deleteSub = useDeleteSubscription()
  const existing = subsQ.data?.find((s) => s.service === origService)
  const isActive = existing ? /^active/i.test(existing.status) : true

  const [service, setService] = useState(existing?.service ?? '')
  const [amount, setAmount] = useState(existing?.amount_inr ?? '')
  const [cycle, setCycle] = useState(existing?.billing_cycle || 'monthly')
  const [nextDueDate, setNextDueDate] = useState(existing?.next_due_date ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [saved, setSaved] = useState(false)
  const [confirmSheet, setConfirmSheet] = useState<'cancel' | 'delete' | null>(null)

  // existing loads async on first mount (query cache may be cold) — backfill once it arrives.
  useEffect(() => {
    if (!existing) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- backfilling an editable form once an async query result arrives, not derivable from render
    setService(existing.service)
    setAmount(existing.amount_inr)
    setCycle(existing.billing_cycle || 'monthly')
    setNextDueDate(existing.next_due_date ?? '')
    setNotes(existing.notes ?? '')
  }, [existing])

  const parsedAmount = Number(amount)
  const canSubmit = service.trim() !== '' && amount.trim() !== '' && !Number.isNaN(parsedAmount) && parsedAmount >= 0
  const saving = addSub.isPending || updateSub.isPending
  const mutatingAction = cancelSub.isPending || reactivateSub.isPending || deleteSub.isPending

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
        {
          onSuccess: () => setSaved(true),
          onError: () => Alert.alert('Could not save subscription', 'Check your connection and try again.'),
        },
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
        {
          onSuccess: () => setSaved(true),
          onError: () => Alert.alert('Could not add subscription', 'Check your connection and try again.'),
        },
      )
    }
  }

  function handleReactivate() {
    reactivateSub.mutate(origService, {
      onSuccess: () => setSaved(true),
      onError: () => Alert.alert('Could not reactivate subscription', 'Check your connection and try again.'),
    })
  }

  function confirmCancel() {
    cancelSub.mutate(origService, {
      onSuccess: () => {
        setConfirmSheet(null)
        setSaved(true)
      },
      onError: () => {
        setConfirmSheet(null)
        Alert.alert('Could not cancel subscription', 'Check your connection and try again.')
      },
    })
  }

  function confirmDelete() {
    deleteSub.mutate(origService, {
      onSuccess: () => {
        setConfirmSheet(null)
        setSaved(true)
      },
      onError: () => {
        setConfirmSheet(null)
        Alert.alert('Could not delete subscription', 'Check your connection and try again.')
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
                  style={[styles.chip, { backgroundColor: selected ? tokens.accent : tokens.pillBg, borderColor: selected ? tokens.accent : tokens.border }]}
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
          disabled={!canSubmit || saving || mutatingAction || saved}
          style={[styles.confirmButton, { backgroundColor: saved ? tokens.mint : tokens.accent, opacity: !canSubmit || saving || mutatingAction ? 0.5 : 1 }]}
        >
          {saved ? (
            <CheckIcon color={tokens.onAccent} />
          ) : (
            <Text style={[styles.confirmText, { color: tokens.onAccent, fontFamily: fontFamily.bodyBold }]}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add subscription'}
            </Text>
          )}
        </Pressable>

        {isEdit && existing && !saved ? (
          <View style={[styles.dangerZone, { borderTopColor: tokens.border }]}>
            <Pressable
              onPress={isActive ? () => setConfirmSheet('cancel') : handleReactivate}
              disabled={saving || mutatingAction}
              style={{ opacity: saving || mutatingAction ? 0.5 : 1 }}
            >
              <Text style={{ color: isActive ? tokens.coral : tokens.mint, fontSize: 14, fontFamily: fontFamily.bodySemiBold, textAlign: 'center' }}>
                {mutatingAction && reactivateSub.isPending
                  ? 'Working…'
                  : isActive
                    ? 'Cancel subscription'
                    : 'Reactivate subscription'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setConfirmSheet('delete')}
              disabled={saving || mutatingAction}
              style={{ marginTop: 16, opacity: saving || mutatingAction ? 0.5 : 1 }}
            >
              <Text style={{ color: tokens.text3, fontSize: 13, fontFamily: fontFamily.bodySemiBold, textAlign: 'center' }}>
                Delete subscription
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <BottomSheet visible={confirmSheet !== null} onClose={() => !mutatingAction && setConfirmSheet(null)}>
        <Text style={[styles.sheetTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
          {confirmSheet === 'delete' ? 'Delete subscription' : 'Cancel subscription'}
        </Text>
        <Text style={[styles.sheetBody, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
          {confirmSheet === 'delete'
            ? `Remove "${origService}"? This cannot be undone.`
            : `Cancel ${origService}? You can reactivate it later.`}
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
            onPress={confirmSheet === 'delete' ? confirmDelete : confirmCancel}
            disabled={mutatingAction}
            style={[styles.sheetSaveButton, { backgroundColor: tokens.coral, opacity: mutatingAction ? 0.6 : 1 }]}
          >
            <Text style={[styles.sheetSaveText, { color: tokens.onAccent, fontFamily: fontFamily.bodyBold }]}>
              {mutatingAction ? 'Working…' : confirmSheet === 'delete' ? 'Delete' : 'Cancel subscription'}
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
