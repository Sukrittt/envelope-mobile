import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, Switch, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Alert } from '@/src/components/ui/AlertHost'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { useAddHolding } from '@/src/hooks/useHoldings'
import { CheckIcon } from '@/src/components/shared/CheckIcon'

const TYPES = ['Equity', 'FD', 'Mutual Fund', 'Gold', 'Crypto', 'Bonds', 'Other']

export default function AddHoldingModal() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const addHolding = useAddHolding()

  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [value, setValue] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [addSuccess, setAddSuccess] = useState(false)

  const parsedValue = Number(value)
  const canSubmit =
    name.trim() !== '' &&
    value.trim() !== '' &&
    !Number.isNaN(parsedValue) &&
    parsedValue >= 0

  // Let the inline checkmark finish drawing before navigating back.
  useEffect(() => {
    if (!addSuccess) return
    const timer = setTimeout(() => router.back(), 1100)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addSuccess])

  function handleAdd() {
    if (!canSubmit) return
    addHolding.mutate(
      {
        name: name.trim(),
        type: type || 'Other',
        value: value.trim(),
        is_recurring: isRecurring,
        recurring_amount: isRecurring ? value.trim() : undefined,
      },
      {
        onSuccess: () => setAddSuccess(true),
        onError: () => Alert.alert('Could not add holding', 'Check your connection and try again.'),
      },
    )
  }

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
          Add Holding
        </Text>
        <View style={{ width: 52 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Stocks"
            placeholderTextColor={tokens.text3}
            style={[styles.input, { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text, fontFamily: fontFamily.bodyMedium }]}
            autoFocus
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>Type</Text>
          <View style={styles.typeRow}>
            {TYPES.map((t) => {
              const selected = type === t
              return (
                <Pressable
                  key={t}
                  onPress={() => setType(t)}
                  style={[
                    styles.typePill,
                    {
                      backgroundColor: selected ? tokens.accent : tokens.pillBg,
                      borderColor: selected ? tokens.accent : tokens.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.typePillText,
                      { color: selected ? tokens.onAccent : tokens.text2, fontFamily: fontFamily.bodySemiBold },
                    ]}
                  >
                    {t}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>
            Value (₹)
          </Text>
          <View style={[styles.inputRow, { backgroundColor: tokens.inputBg, borderColor: tokens.border }]}>
            <Text style={[styles.currency, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>₹</Text>
            <TextInput
              value={value}
              onChangeText={setValue}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={tokens.text3}
              style={[styles.amountInput, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}
            />
          </View>
        </View>

        <View style={styles.field}>
          <View style={styles.recurringRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>
                Repeat monthly (SIP/PF)
              </Text>
              <Text style={[styles.recurringHint, { color: tokens.text3, fontFamily: fontFamily.bodyMedium }]}>
                Auto-adds the value above as a contribution on this day every month
              </Text>
            </View>
            <Switch
              value={isRecurring}
              onValueChange={setIsRecurring}
              trackColor={{ false: tokens.borderStrong, true: tokens.accent }}
              thumbColor={tokens.onAccent}
            />
          </View>
        </View>

        <Pressable
          onPress={handleAdd}
          disabled={!canSubmit || addHolding.isPending || addSuccess}
          style={[
            styles.confirmButton,
            {
              backgroundColor: addSuccess ? tokens.mint : tokens.accent,
              opacity: !canSubmit || addHolding.isPending ? 0.5 : 1,
            },
          ]}
        >
          {addSuccess ? (
            <CheckIcon color={tokens.onAccent} />
          ) : (
            <Text style={[styles.confirmText, { color: tokens.onAccent, fontFamily: fontFamily.bodyBold }]}>
              {addHolding.isPending ? 'Adding…' : 'Add Holding'}
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
  body: { padding: 20, gap: 20 },
  field: { gap: 8 },
  fieldLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  recurringRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recurringHint: { fontSize: 12, marginTop: 4, textTransform: 'none', letterSpacing: 0 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typePill: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  typePillText: { fontSize: 13 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, gap: 6 },
  currency: { fontSize: 18 },
  amountInput: { flex: 1, fontSize: 18, paddingVertical: 14 },
  confirmButton: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  confirmText: { fontSize: 16 },
})
