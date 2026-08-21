import { useState } from 'react'
import { View, Text, Pressable, ScrollView, Alert, Share, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, Trash2 } from 'lucide-react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { Icon } from '@/src/components/shared/Icon'
import { BottomSheet } from '@/src/components/shared/Modal'
import { clearTransactions, exportData, getDataSummary } from '@/src/api/account'

const summaryKey = ['dataSummary'] as const

// ponytail: shares the exported text straight through RN's built-in Share
// sheet instead of writing a temp file via expo-file-system + expo-sharing —
// expo-file-system isn't installed, and Share.share needs no new dependency.
// Swap in a real file share if users need to hand off large exports as .csv/.json.
export default function DataScreen() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const qc = useQueryClient()
  const summaryQuery = useQuery({ queryKey: summaryKey, queryFn: getDataSummary, staleTime: 30_000 })

  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null)
  const [clearing, setClearing] = useState(false)
  const [confirmingClear, setConfirmingClear] = useState(false)

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(format)
    try {
      const content = await exportData(format)
      await Share.share({ message: content })
    } catch {
      Alert.alert('Export failed', 'Check your connection and try again.')
    } finally {
      setExporting(null)
    }
  }

  const doClear = async () => {
    setClearing(true)
    try {
      await clearTransactions()
      qc.invalidateQueries()
      setConfirmingClear(false)
    } catch {
      Alert.alert('Could not clear transactions', 'Check your connection and try again.')
    } finally {
      setClearing(false)
    }
  }

  const summary = summaryQuery.data
  const summaryLine = summary
    ? `${summary.transactionCount.toLocaleString()} transactions · ${summary.envelopeCount.toLocaleString()} envelopes`
    : '—'

  return (
    <View style={[styles.container, { backgroundColor: tokens.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: tokens.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={[styles.backButton, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
          <Icon icon={ArrowLeft} size={20} color={tokens.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>Your data</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}>
        <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
          <Text style={[styles.cardTitle, { color: tokens.text, fontFamily: fontFamily.bodyExtraBold }]}>Export</Text>
          <Text style={[styles.cardMeta, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>{summaryLine}</Text>
          <View style={styles.exportRow}>
            <Pressable
              onPress={() => handleExport('csv')}
              disabled={exporting !== null}
              style={[styles.exportButton, { borderColor: tokens.borderStrong, backgroundColor: tokens.inputBg }]}
            >
              <Text style={[styles.exportButtonText, { color: tokens.text, fontFamily: fontFamily.bodyBold }]}>
                {exporting === 'csv' ? 'Exporting…' : 'CSV'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleExport('json')}
              disabled={exporting !== null}
              style={[styles.exportButton, { borderColor: tokens.borderStrong, backgroundColor: tokens.inputBg }]}
            >
              <Text style={[styles.exportButtonText, { color: tokens.text, fontFamily: fontFamily.bodyBold }]}>
                {exporting === 'json' ? 'Exporting…' : 'JSON'}
              </Text>
            </Pressable>
          </View>
        </View>

        <Pressable
          onPress={() => setConfirmingClear(true)}
          disabled={clearing}
          style={[styles.clearRow, { borderColor: tokens.borderStrong, opacity: clearing ? 0.6 : 1 }]}
        >
          <Icon icon={Trash2} size={16} color={tokens.coral} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.clearTitle, { color: tokens.coral, fontFamily: fontFamily.bodyBold }]}>
              {clearing ? 'Clearing…' : 'Clear all transactions'}
            </Text>
            <Text style={[styles.clearHint, { color: tokens.text2 }]}>Keeps envelopes, wipes history</Text>
          </View>
        </Pressable>
      </ScrollView>

      <BottomSheet visible={confirmingClear} onClose={() => !clearing && setConfirmingClear(false)}>
        <Text style={[styles.sheetTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
          Clear all transactions
        </Text>
        <Text style={[styles.sheetBody, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
          {summary
            ? `Deletes ${summary.transactionCount.toLocaleString()} transactions. Your envelopes and their assigned amounts stay. This can't be undone.`
            : "Deletes every transaction. Your envelopes and their assigned amounts stay. This can't be undone."}
        </Text>
        <View style={styles.sheetButtonRow}>
          <Pressable
            onPress={() => setConfirmingClear(false)}
            disabled={clearing}
            style={[styles.sheetCancelButton, { opacity: clearing ? 0.5 : 1 }]}
          >
            <Text style={[styles.sheetCancelText, { color: tokens.text2, fontFamily: fontFamily.bodyBold }]}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={doClear}
            disabled={clearing}
            style={[styles.sheetSaveButton, styles.sheetDeleteButton, { backgroundColor: tokens.coral, opacity: clearing ? 0.6 : 1 }]}
          >
            <Text style={[styles.sheetSaveText, { color: tokens.onAccent, fontFamily: fontFamily.bodyBold }]}>
              {clearing ? 'Clearing…' : 'Clear'}
            </Text>
          </Pressable>
        </View>
      </BottomSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  backButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 19 },
  scrollContent: { padding: 16, gap: 12 },
  card: { padding: 16, borderWidth: 1, borderRadius: 20 },
  cardTitle: { fontSize: 14 },
  cardMeta: { fontSize: 12, marginTop: 4 },
  exportRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  exportButton: { flex: 1, minHeight: 44, borderRadius: 100, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  exportButtonText: { fontSize: 13 },
  clearRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderWidth: 1, borderRadius: 20 },
  clearTitle: { fontSize: 14 },
  clearHint: { fontSize: 11, marginTop: 2 },
  sheetTitle: { fontSize: 18, marginBottom: 12 },
  sheetBody: { fontSize: 13, lineHeight: 18 },
  sheetSaveButton: { marginTop: 12, minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  sheetSaveText: { fontSize: 14 },
  sheetButtonRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  sheetDeleteButton: { flex: 1, marginTop: 0 },
  sheetCancelButton: { flex: 1, minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  sheetCancelText: { fontSize: 14 },
})
