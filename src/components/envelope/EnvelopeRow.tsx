import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { formatCurrency } from '@/src/lib/format'
import { splitEmoji } from '@/src/lib/emoji'
import { toISTDateString } from '@/src/lib/date'
import { ProgressBar } from './ProgressBar'
import { CheckIcon } from '@/src/components/shared/CheckIcon'
import { BottomSheet } from '@/src/components/shared/Modal'
import type { Envelope } from '@/src/lib/envelope'

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Mirrors Web's EnvelopeGrid usedPct(): spend as % of assigned, ∞ if spending with nothing assigned. */
function usedPctLabel(e: Envelope): string {
  if (e.assigned > 0) return `${Math.round((e.spent / e.assigned) * 100)}%`
  return e.spent > 0 ? '∞' : '—'
}

/** Mirrors Web's EnvelopeGrid lastSpentLabel(), written by hand (no Intl) per this app's date-formatting convention. */
function lastSpentLabel(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const today = new Date()
  const todayStr = toISTDateString(today)
  if (iso === todayStr) return 'Today'
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (iso === toISTDateString(yesterday)) return 'Yesterday'
  const days = Math.round((today.getTime() - d.getTime()) / 86400000)
  if (days >= 1 && days <= 31) return `${days}d ago`
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`
}

interface Props {
  envelope: Envelope
  emoji: string
  hideAmounts: boolean
  /** Overrides the displayed name (used for the Credit Card Payment special envelope). */
  displayName?: string
  onMoveMoney: (category: string) => void
  onEditAmount: (category: string, newAssigned: number) => Promise<void>
  onViewTransactions: (category: string) => void
  /** Told when this row's action sheet opens/closes — Home uses it to hold
   * Ready to Assign's displayed value frozen while the sheet covers it, so
   * an edit's odometer roll plays on reveal instead of finishing unseen
   * behind the sheet. Optional: only Home's rows need to report this. */
  onSheetOpenChange?: (open: boolean) => void
}

/** A single envelope row + its tap-to-open action sheet (move money / edit amount / view transactions). */
export function EnvelopeRow({
  envelope,
  emoji,
  hideAmounts,
  displayName,
  onMoveMoney,
  onEditAmount,
  onViewTransactions,
  onSheetOpenChange,
}: Props) {
  const { tokens } = useTheme()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [amountText, setAmountText] = useState(String(envelope.assigned))
  const [editSaving, setEditSaving] = useState(false)
  const [editSuccess, setEditSuccess] = useState(false)
  const [editError, setEditError] = useState('')

  function openSheet() {
    setAmountText(String(envelope.assigned))
    setEditing(false)
    setSheetOpen(true)
    onSheetOpenChange?.(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setEditing(false)
    setEditSuccess(false)
    setEditError('')
    onSheetOpenChange?.(false)
  }

  async function submitEdit() {
    const value = Math.round(Number(amountText)) || 0
    setEditSaving(true)
    setEditError('')
    try {
      await onEditAmount(envelope.category, value)
      setEditSuccess(true)
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setEditSaving(false)
    }
  }

  // Let the inline checkmark finish drawing before closing the sheet.
  useEffect(() => {
    if (!editSuccess) return
    const timer = setTimeout(closeSheet, 1100)
    return () => clearTimeout(timer)
  }, [editSuccess])

  const availableColor = envelope.isOverspent ? tokens.coral : tokens.mint
  const name = displayName ?? splitEmoji(envelope.category).text

  return (
    <View style={styles.row}>
      <Pressable style={styles.main} onPress={openSheet}>
        <View style={styles.topLine}>
          <Text style={{ fontSize: 14 }}>{emoji}</Text>
          <Text
            style={[styles.name, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}
            numberOfLines={1}
          >
            {name}
          </Text>
          <Text style={[styles.spentOf, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
            {formatCurrency(envelope.spent, hideAmounts)}/{formatCurrency(envelope.assigned, hideAmounts)}
          </Text>
        </View>
        <ProgressBar pct={envelope.spentPct} />
        {!envelope.isCreditCardPayment && (
          <Text style={[styles.metaLine, { color: tokens.text3, fontFamily: fontFamily.bodyMedium }]}>
            Used {usedPctLabel(envelope)} · Last spent {lastSpentLabel(envelope.lastSpentDate)}
          </Text>
        )}
      </Pressable>
      <Text style={[styles.available, { color: availableColor, fontFamily: fontFamily.bodySemiBold }]}>
        {formatCurrency(envelope.available, hideAmounts)}
      </Text>

      <BottomSheet visible={sheetOpen} onClose={closeSheet}>
        <Text style={[styles.sheetTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
          {name}
        </Text>
        {!editing ? (
          <>
            <Pressable
              style={styles.sheetBtn}
              onPress={() => {
                closeSheet()
                onMoveMoney(envelope.category)
              }}
            >
              <Text style={[styles.sheetBtnText, { color: tokens.text, fontFamily: fontFamily.bodyMedium }]}>
                Move money between envelopes
              </Text>
            </Pressable>
            <Pressable style={styles.sheetBtn} onPress={() => setEditing(true)}>
              <Text style={[styles.sheetBtnText, { color: tokens.text, fontFamily: fontFamily.bodyMedium }]}>
                Edit assigned amount
              </Text>
            </Pressable>
            {!envelope.isCreditCardPayment && (
              <Pressable
                style={styles.sheetBtn}
                onPress={() => {
                  closeSheet()
                  onViewTransactions(envelope.category)
                }}
              >
                <Text style={[styles.sheetBtnText, { color: tokens.text, fontFamily: fontFamily.bodyMedium }]}>
                  View transactions
                </Text>
              </Pressable>
            )}
          </>
        ) : (
          <>
            <View style={styles.editRow}>
              <TextInput
                style={[styles.input, { backgroundColor: tokens.inputBg, borderColor: tokens.borderStrong, color: tokens.text }]}
                keyboardType="number-pad"
                value={amountText}
                onChangeText={setAmountText}
                autoFocus
              />
              <Pressable
                style={[
                  styles.confirmBtn,
                  { backgroundColor: editSuccess ? tokens.mint : tokens.accent, opacity: editSaving ? 0.5 : 1 },
                ]}
                onPress={submitEdit}
                disabled={editSaving || editSuccess}
              >
                {editSuccess ? (
                  <CheckIcon color={tokens.onAccent} size={16} />
                ) : (
                  <Text style={{ color: tokens.onAccent, fontFamily: fontFamily.bodyBold }}>
                    {editSaving ? 'Saving…' : 'Save'}
                  </Text>
                )}
              </Pressable>
            </View>
            {editError !== '' && (
              <Text style={{ color: tokens.coral, fontSize: 12, marginTop: 6 }}>{editError}</Text>
            )}
          </>
        )}
      </BottomSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  main: { flex: 1, gap: 6 },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 13, flexShrink: 1 },
  metaLine: { fontSize: 10, marginTop: 2 },
  spentOf: { marginLeft: 'auto', fontSize: 12 },
  available: { fontSize: 12, minWidth: 60, textAlign: 'right' },
  sheetTitle: { fontSize: 16, marginBottom: 8 },
  sheetBtn: { paddingVertical: 12 },
  sheetBtnText: { fontSize: 14 },
  editRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'stretch' },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 14 },
  confirmBtn: { paddingHorizontal: 18, justifyContent: 'center', borderRadius: 12 },
})
