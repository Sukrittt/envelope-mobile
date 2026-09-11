import { View, Text, Pressable, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, ChevronRight, Receipt } from 'lucide-react-native'
import Reanimated from 'react-native-reanimated'
import { OfflineScreen } from '@/src/components/shared/OfflineScreen'
import { useOnline } from '@/src/lib/netStatus'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { Icon } from '@/src/components/shared/Icon'
import { LoadingPhrase } from '@/src/components/shared/LoadingPhrase'
import { usePrivacy } from '@/src/context/PrivacyContext'
import { formatCurrency, formatDateShort } from '@/src/lib/format'
import { splitEmoji } from '@/src/lib/emoji'
import { useBillScans } from '@/src/hooks/useBillScans'
import { useRefresh } from '@/src/hooks/useRefresh'
import { PopIn } from '@/src/components/shared/PopIn'
import { usePressSpring } from '@/src/components/ui/Button'
import type { BillScanSummary } from '@/src/api/bills'

const LOADING_PHRASES = [
  'Pulling up your scans…',
  'Sorting by date…',
  'Almost there…',
]

// ponytail: fifth copy of this stagger pair (recurring.tsx, investments.tsx,
// modals/money-brain.tsx, features/scan-bill/presentation.ts) — worth a shared
// spot in src/theme/scale.ts if a sixth shows up.
const MOUNT_DELAY = 100
const ITEM_STAGGER = 45
const STAGGER_CAP = 6

export default function BillScansScreen() {
  const { tokens } = useTheme()
  const { hideAmounts } = usePrivacy()
  const online = useOnline()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { refreshing, onRefresh } = useRefresh()
  const scansQ = useBillScans()

  const rows = scansQ.data ?? []

  if (!online) return <OfflineScreen />

  return (
    <View style={[styles.container, { backgroundColor: tokens.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: tokens.border }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={[styles.backButton, { backgroundColor: tokens.card, borderColor: tokens.border }]}
        >
          <Icon icon={ArrowLeft} size={20} color={tokens.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>Scan history</Text>
          <Text style={[styles.headerSub, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>
            {rows.length === 0 ? 'Nothing scanned yet' : `${rows.length} scanned`}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={scansQ.isLoading || rows.length === 0 ? styles.centered : styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.accent} colors={[tokens.accent]} />}
      >
        {scansQ.isLoading ? (
          <LoadingPhrase phrases={LOADING_PHRASES} color={tokens.text2} style={[styles.loadingPhrase, { fontFamily: fontFamily.bodyMedium }]} />
        ) : rows.length === 0 ? (
          <>
            <Icon icon={Receipt} size={28} color={tokens.text3} />
            <Text style={[styles.emptyTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>No scans yet</Text>
            <Text style={[styles.emptyBody, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
              Scan a bill from the You tab and it&apos;ll show up here, photo and all.
            </Text>
          </>
        ) : (
          <View style={{ gap: 10 }}>
            {rows.map((row, i) => (
              <BillScanRow key={row.id} row={row} index={i} hideAmounts={hideAmounts} onPress={() => router.push(`/modals/bill-scan?id=${row.id}`)} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

function BillScanRow({
  row,
  index,
  hideAmounts,
  onPress,
}: {
  row: BillScanSummary
  index: number
  hideAmounts: boolean
  onPress: () => void
}) {
  const { tokens } = useTheme()
  const press = usePressSpring(0.98)
  const category = splitEmoji(row.category)

  return (
    <PopIn play delay={MOUNT_DELAY + Math.min(index, STAGGER_CAP) * ITEM_STAGGER} style={[styles.rowCard, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
      <Reanimated.View style={press.style}>
        <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} style={styles.rowInner}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]} numberOfLines={1}>
              {row.merchant}
            </Text>
            <Text style={[styles.rowMeta, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]} numberOfLines={1}>
              {category.text || row.category} · {formatDateShort(row.date)} · {row.item_count} {row.item_count === 1 ? 'item' : 'items'}
            </Text>
          </View>
          <Text style={[styles.rowAmount, { color: tokens.text, fontFamily: fontFamily.bodyBold }]}>
            {formatCurrency(row.my_share, hideAmounts)}
          </Text>
          <ChevronRight size={16} color={tokens.text3} strokeWidth={2} />
        </Pressable>
      </Reanimated.View>
    </PopIn>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 19 },
  headerSub: { fontSize: 11.5, marginTop: 1 },
  body: { padding: 16 },
  rowCard: { borderWidth: 1, borderRadius: 14 },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  rowTitle: { fontSize: 15 },
  rowMeta: { fontSize: 12, marginTop: 2 },
  rowAmount: { fontSize: 15 },
  centered: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24, marginTop: -72 },
  loadingPhrase: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  emptyTitle: { fontSize: 17, marginTop: 4 },
  emptyBody: { fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 250 },
})
