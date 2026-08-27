import { useEffect, useMemo, useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTheme } from '@/src/theme/ThemeProvider'
import { usePrivacy } from '@/src/context/PrivacyContext'
import { fontFamily } from '@/src/theme/fonts'
import { formatCurrency } from '@/src/lib/format'
import { CheckIcon } from '@/src/components/shared/CheckIcon'
import { useBudgets, useUpdateBudget, useAddBudget } from '@/src/hooks/useBudgets'
import { useExpenses } from '@/src/hooks/useExpenses'
import { useCategories } from '@/src/hooks/useCategories'
import { useGroups } from '@/src/hooks/useGroups'
import { computeEnvelopeState, currentMonthKey } from '@/src/lib/envelope'
import type { ThemeTokens } from '@/src/theme/tokens'
import { EMPTY } from '@/src/lib/constants'

const RTA_SENTINEL = '__ready_to_assign__'

function str(v: string | string[] | undefined): string {
  return typeof v === 'string' ? v : ''
}

// There's no dedicated "move money" API endpoint (confirmed against Web's
// ExpensePage.tsx onTransfer handler) — a move is just two budget.assigned
// mutations (or one, when the source is Ready to Assign).
export default function MoveMoneyModal() {
  const { tokens } = useTheme()
  const { hideAmounts } = usePrivacy()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const params = useLocalSearchParams()
  // Home's handleMoveMoney passes the tapped envelope as `fromCategory`, but per
  // its call site (app/(tabs)/index.tsx) it's actually the RECIPIENT — mirrors
  // Web's MoveMoneyModal `targetCategory` prop. The source is chosen below.
  const targetCategoryName = str(params.fromCategory)

  const budgetsQ = useBudgets()
  const expensesQ = useExpenses()
  const categoriesQ = useCategories()
  const groupsQ = useGroups()
  const updateBudget = useUpdateBudget()
  const addBudget = useAddBudget()

  const budgets = budgetsQ.data ?? EMPTY
  const expenses = expensesQ.data ?? EMPTY
  const categories = categoriesQ.data ?? EMPTY
  const groups = groupsQ.data ?? EMPTY
  const month = useMemo(() => currentMonthKey(), [])

  const envelopeState = useMemo(
    () => computeEnvelopeState(budgets, expenses, month, categories, groups),
    [budgets, expenses, month, categories, groups],
  )

  const target = envelopeState.envelopes.find((e) => e.category === targetCategoryName)
  const targetAvail = target?.available ?? 0
  const isOverspent = targetAvail < 0
  const readyToAssign = envelopeState.readyToAssign

  const envelopeSources = envelopeState.envelopes.filter(
    (e) => e.available > 0 && e.category !== targetCategoryName && !e.isCreditCardPayment,
  )

  const [selectedSource, setSelectedSource] = useState(
    readyToAssign > 0 ? RTA_SENTINEL : (envelopeSources[0]?.category ?? RTA_SENTINEL),
  )
  const [amount, setAmount] = useState(isOverspent ? String(Math.round(Math.abs(targetAvail))) : '')
  const [error, setError] = useState('')
  const [moveSuccess, setMoveSuccess] = useState(false)

  const maxAvailable = useMemo(() => {
    if (selectedSource === RTA_SENTINEL) return readyToAssign
    return envelopeSources.find((e) => e.category === selectedSource)?.available ?? 0
  }, [selectedSource, envelopeSources, readyToAssign])

  const parsedAmount = Number(amount) || 0
  const isOverLimit = parsedAmount > maxAvailable
  const canSubmit = selectedSource !== '' && parsedAmount > 0 && !isOverLimit
  const resultingBalance = parsedAmount > 0 ? maxAvailable - parsedAmount : null

  const isLoading = budgetsQ.isLoading || expensesQ.isLoading || categoriesQ.isLoading || groupsQ.isLoading
  const saving = updateBudget.isPending || addBudget.isPending

  // Let the inline checkmark finish drawing before navigating back.
  useEffect(() => {
    if (!moveSuccess) return
    const timer = setTimeout(() => router.back(), 1100)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveSuccess])

  async function setAssigned(category: string, newAssigned: number) {
    const exists = budgets.some((b) => b.month === month && b.category === category)
    if (exists) {
      await updateBudget.mutateAsync({ month, category, updates: { assigned: String(newAssigned) } })
    } else {
      await addBudget.mutateAsync({ month, category, assigned: String(newAssigned) })
    }
  }

  async function handleSubmit() {
    if (!canSubmit || !target) return
    setError('')
    try {
      if (selectedSource === RTA_SENTINEL) {
        await setAssigned(targetCategoryName, target.assigned + parsedAmount)
      } else {
        const source = envelopeSources.find((e) => e.category === selectedSource)
        if (!source) return
        await Promise.all([
          setAssigned(source.category, source.assigned - parsedAmount),
          setAssigned(targetCategoryName, target.assigned + parsedAmount),
        ])
      }
      setMoveSuccess(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to move money')
    }
  }

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: tokens.bg }]}>
        <ActivityIndicator color={tokens.accentInk} />
      </View>
    )
  }

  const noOptions = !target || (envelopeSources.length === 0 && readyToAssign <= 0)

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: tokens.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: tokens.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.headerAction, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>
            Cancel
          </Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
          Move money
        </Text>
        <View style={{ width: 52 }} />
      </View>

      {noOptions ? (
        <View style={styles.body}>
          <Text style={{ color: tokens.text2, fontSize: 13, fontFamily: fontFamily.bodyMedium }}>
            {!target ? `${targetCategoryName} isn't set up as an envelope.` : 'No funds available to pull from.'}
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={[styles.confirmButton, { backgroundColor: tokens.inputBg, marginTop: 16 }]}
          >
            <Text style={[styles.confirmText, { color: tokens.text, fontFamily: fontFamily.bodyBold }]}>Close</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={[styles.description, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
            {isOverspent
              ? `Cover ${formatCurrency(Math.abs(targetAvail), hideAmounts)} overspent in ${targetCategoryName}`
              : `Move money to ${targetCategoryName} (currently ${formatCurrency(targetAvail, hideAmounts)} available)`}
          </Text>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>From</Text>
            <View style={{ gap: 8 }}>
              {readyToAssign > 0 && (
                <SourceOption
                  label={`Ready to Assign (${formatCurrency(readyToAssign, hideAmounts)} available)`}
                  selected={selectedSource === RTA_SENTINEL}
                  onPress={() => setSelectedSource(RTA_SENTINEL)}
                  tokens={tokens}
                />
              )}
              {envelopeSources.map((e) => (
                <SourceOption
                  key={e.category}
                  label={`${e.category} (${formatCurrency(e.available, hideAmounts)} available)`}
                  selected={selectedSource === e.category}
                  onPress={() => setSelectedSource(e.category)}
                  tokens={tokens}
                />
              ))}
            </View>
          </View>

          {parsedAmount > 0 && resultingBalance !== null && (
            <Text
              style={{
                color: resultingBalance >= 0 ? tokens.text2 : tokens.coral,
                fontSize: 12,
                fontFamily: fontFamily.bodyMedium,
              }}
            >
              {resultingBalance >= 0
                ? `${selectedSource === RTA_SENTINEL ? 'Ready to Assign' : selectedSource} will have ${formatCurrency(resultingBalance, hideAmounts)} available after this move`
                : `Source only has ${formatCurrency(maxAvailable, hideAmounts)}. Reduce the amount.`}
            </Text>
          )}

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>Amount</Text>
            <View style={[styles.inputRow, { backgroundColor: tokens.inputBg, borderColor: tokens.border }]}>
              <Text style={[styles.currency, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>₹</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={tokens.text3}
                style={[styles.amountInput, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}
                autoFocus
              />
            </View>
          </View>

          {error !== '' && (
            <Text style={[styles.error, { color: tokens.coral, fontFamily: fontFamily.bodyMedium }]}>{error}</Text>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit || saving || moveSuccess}
            style={[
              styles.confirmButton,
              { backgroundColor: moveSuccess ? tokens.mint : tokens.accent, opacity: !canSubmit || saving ? 0.5 : 1 },
            ]}
          >
            {moveSuccess ? (
              <CheckIcon color={tokens.onAccent} />
            ) : (
              <Text style={[styles.confirmText, { color: tokens.onAccent, fontFamily: fontFamily.bodyBold }]}>
                {saving ? 'Moving…' : `Move ${formatCurrency(parsedAmount, hideAmounts)}`}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  )
}

function SourceOption({
  label,
  selected,
  onPress,
  tokens,
}: {
  label: string
  selected: boolean
  onPress: () => void
  tokens: ThemeTokens
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.sourceOption,
        { backgroundColor: selected ? tokens.accentSoft : tokens.inputBg, borderColor: selected ? tokens.accent : tokens.border },
      ]}
    >
      <View style={[styles.radioDot, { borderColor: selected ? tokens.accent : tokens.text3 }]}>
        {selected && <View style={[styles.radioDotFill, { backgroundColor: tokens.accent }]} />}
      </View>
      <Text style={[styles.sourceLabel, { color: tokens.text, fontFamily: fontFamily.bodyMedium }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
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
  description: { fontSize: 13 },
  field: { gap: 8 },
  fieldLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  sourceOption: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  radioDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDotFill: { width: 8, height: 8, borderRadius: 4 },
  sourceLabel: { fontSize: 13, flex: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, gap: 6 },
  currency: { fontSize: 20 },
  amountInput: { flex: 1, fontSize: 20, paddingVertical: 14 },
  error: { fontSize: 12 },
  confirmButton: { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  confirmText: { fontSize: 16 },
})
