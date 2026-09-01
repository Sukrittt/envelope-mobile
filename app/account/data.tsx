import { useState } from 'react'
import { View, Text, Pressable, ScrollView, Alert, Linking, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, Trash2 } from 'lucide-react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { Icon } from '@/src/components/shared/Icon'
import { BottomSheet } from '@/src/components/shared/Modal'
import { clearTransactions, getDataSummary, startExport, getExports, type ExportRow } from '@/src/api/account'

const summaryKey = ['dataSummary'] as const
const exportsKey = ['exports'] as const

export default function DataScreen() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const qc = useQueryClient()
  const summaryQuery = useQuery({ queryKey: summaryKey, queryFn: getDataSummary, staleTime: 30_000 })
  const exportsQuery = useQuery({
    queryKey: exportsKey,
    queryFn: getExports,
    // Poll only while something's still building — a push notification is the
    // real "it's done" signal, this just catches the screen up if it's open.
    refetchInterval: (query) => (query.state.data?.exports.some((e) => e.status === 'pending') ? 4000 : false),
  })

  const [starting, setStarting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [confirmingClear, setConfirmingClear] = useState(false)

  const exportsData = exportsQuery.data
  const atLimit = exportsData ? exportsData.usedThisMonth >= exportsData.limit : false
  const pending = exportsData?.exports.some((e) => e.status === 'pending') ?? false

  const handleStartExport = async () => {
    setStarting(true)
    try {
      await startExport()
    } catch (err) {
      if (err instanceof Error && err.message === 'quota_exceeded') {
        const limit = exportsData?.limit
        Alert.alert(limit ? `You've used all ${limit} exports this month` : "You've used your export limit this month", 'Resets next month.')
      } else {
        Alert.alert('Export failed', 'Check your connection and try again.')
      }
    } finally {
      setStarting(false)
      void qc.invalidateQueries({ queryKey: exportsKey })
    }
  }

  const handleDownload = (row: ExportRow) => {
    if (row.blob_url) void Linking.openURL(row.blob_url)
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
          {exportsData ? (
            <Text style={[styles.cardMeta, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
              {exportsData.usedThisMonth} of {exportsData.limit} exports used this month
            </Text>
          ) : null}
          <View style={styles.exportRow}>
            <Pressable
              onPress={handleStartExport}
              disabled={starting || pending || atLimit}
              style={[styles.exportButton, { borderColor: tokens.borderStrong, backgroundColor: tokens.inputBg }]}
            >
              <Text style={[styles.exportButtonText, { color: tokens.text, fontFamily: fontFamily.bodyBold }]}>
                {pending ? 'Building…' : starting ? 'Starting…' : 'Export'}
              </Text>
            </Pressable>
          </View>
          {atLimit ? (
            <Text style={[styles.cardMeta, { color: tokens.coral, fontFamily: fontFamily.bodyMedium }]}>
              You&apos;ve used all {exportsData?.limit} exports this month. Resets next month.
            </Text>
          ) : null}
          {exportsData && exportsData.exports.length > 0 ? (
            <View style={{ marginTop: 12, gap: 6 }}>
              {exportsData.exports.map((row) => (
                <Pressable
                  key={row.id}
                  onPress={() => handleDownload(row)}
                  disabled={row.status !== 'ready'}
                  style={styles.exportHistoryRow}
                >
                  <Text style={[styles.exportHistoryText, { color: row.status === 'ready' ? tokens.text : tokens.text2 }]}>
                    {row.created_at} — {row.status}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
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
  exportHistoryRow: { paddingVertical: 4 },
  exportHistoryText: { fontSize: 12 },
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
