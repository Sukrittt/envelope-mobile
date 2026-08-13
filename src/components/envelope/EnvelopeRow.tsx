import { useEffect, useState } from 'react'
import { View, Text, Pressable, Modal, TextInput, StyleSheet } from 'react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { formatCurrency } from '@/src/lib/format'
import { splitEmoji } from '@/src/lib/emoji'
import { ProgressBar } from './ProgressBar'
import { CheckIcon } from '@/src/components/shared/CheckIcon'
import type { Envelope } from '@/src/lib/envelope'

interface Props {
  envelope: Envelope
  emoji: string
  hideAmounts: boolean
  /** Overrides the displayed name (used for the Credit Card Payment special envelope). */
  displayName?: string
  onMoveMoney: (category: string) => void
  onEditAmount: (category: string, newAssigned: number) => Promise<void>
}

/** A single envelope row + its tap-to-open action sheet (move money / edit amount). */
export function EnvelopeRow({ envelope, emoji, hideAmounts, displayName, onMoveMoney, onEditAmount }: Props) {
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
  }

  function closeSheet() {
    setSheetOpen(false)
    setEditing(false)
    setEditSuccess(false)
    setEditError('')
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      </Pressable>
      <Text style={[styles.available, { color: availableColor, fontFamily: fontFamily.bodySemiBold }]}>
        {formatCurrency(envelope.available, hideAmounts)}
      </Text>

      <Modal visible={sheetOpen} transparent animationType="fade" onRequestClose={closeSheet}>
        <Pressable style={styles.backdrop} onPress={closeSheet}>
          <Pressable
            style={[styles.sheet, { backgroundColor: tokens.modalBg, borderColor: tokens.borderStrong }]}
            onPress={(e) => e.stopPropagation()}
          >
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
                      { backgroundColor: editSuccess ? tokens.mint : tokens.gold, opacity: editSaving ? 0.5 : 1 },
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
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  main: { flex: 1, gap: 6 },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 13, flexShrink: 1 },
  spentOf: { marginLeft: 'auto', fontSize: 12 },
  available: { fontSize: 12, minWidth: 60, textAlign: 'right' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 16, gap: 4, paddingBottom: 32 },
  sheetTitle: { fontSize: 16, marginBottom: 8 },
  sheetBtn: { paddingVertical: 12 },
  sheetBtnText: { fontSize: 14 },
  editRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'stretch' },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 14 },
  confirmBtn: { paddingHorizontal: 18, justifyContent: 'center', borderRadius: 12 },
})
