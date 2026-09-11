import { View, Text, Image, Pressable, ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { usePrivacy } from '@/src/context/PrivacyContext'
import { formatCurrency, formatDate } from '@/src/lib/format'
import { splitEmoji } from '@/src/lib/emoji'
import { useBillScan } from '@/src/hooks/useBillScans'
import { LoadingPhrase } from '@/src/components/shared/LoadingPhrase'
import type { BillScanItem } from '@/src/api/bills'

function str(v: string | string[] | undefined): string {
  return typeof v === 'string' ? v : ''
}

const LOADING_PHRASES = ['Pulling up this scan…', 'Almost there…']

export default function BillScanModal() {
  const { tokens } = useTheme()
  const { hideAmounts } = usePrivacy()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const id = str(useLocalSearchParams().id)

  const scanQ = useBillScan(id)
  const scan = scanQ.data
  const category = splitEmoji(scan?.category ?? '')

  return (
    <View style={[styles.container, { backgroundColor: tokens.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: tokens.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.headerAction, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>Close</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]} numberOfLines={1}>
          {scan?.merchant || 'Scan detail'}
        </Text>
        <View style={{ width: 52 }} />
      </View>

      {scanQ.isLoading ? (
        <View style={styles.centered}>
          <LoadingPhrase phrases={LOADING_PHRASES} color={tokens.text2} style={{ fontFamily: fontFamily.bodyMedium }} />
        </View>
      ) : !scan ? (
        <View style={styles.centered}>
          <Text style={[styles.emptyText, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
            Couldn&apos;t find that scan.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {scan.image_status === 'ready' && scan.image_url ? (
            <Image source={{ uri: scan.image_url }} style={[styles.photo, { backgroundColor: tokens.inputBg }]} resizeMode="cover" />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder, { backgroundColor: tokens.inputBg }]}>
              <Text style={[styles.photoPlaceholderText, { color: tokens.text3, fontFamily: fontFamily.bodyMedium }]}>
                {scan.image_status === 'failed' ? "Photo couldn't be saved" : 'Photo still uploading…'}
              </Text>
            </View>
          )}

          <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
            <View style={styles.summaryRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.merchant, { color: tokens.text, fontFamily: fontFamily.bodyBold }]}>{scan.merchant}</Text>
                <Text style={[styles.summaryMeta, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
                  {(category.text || scan.category)} · {formatDate(scan.date)}
                </Text>
              </View>
              <Text style={[styles.myShare, { color: tokens.text, fontFamily: fontFamily.bodyBold }]}>
                {formatCurrency(scan.my_share, hideAmounts)}
              </Text>
            </View>
            <View style={[styles.divider, { backgroundColor: tokens.border }]} />
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>Bill total</Text>
              <Text style={[styles.summaryValue, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>
                {formatCurrency(scan.total, hideAmounts)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>Split between</Text>
              <Text style={[styles.summaryValue, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>
                {scan.people_count} {scan.people_count === 1 ? 'person' : 'people'}
              </Text>
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: tokens.text3, fontFamily: fontFamily.bodyBold }]}>ITEMS</Text>
          <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
            {scan.items.map((item, i) => (
              <View key={`${item.name}-${i}`}>
                {i > 0 && <View style={[styles.divider, { backgroundColor: tokens.border }]} />}
                <ItemRow item={item} />
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  )
}

function ItemRow({ item }: { item: BillScanItem }) {
  const { tokens } = useTheme()
  const { hideAmounts } = usePrivacy()
  const shareLabel = item.divisor === null ? 'Not yours' : item.divisor > 1 ? `Split ÷${item.divisor}` : 'Yours'

  return (
    <View style={styles.summaryRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.itemName, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.itemMeta, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
          {item.qty > 1 ? `× ${item.qty} · ` : ''}{shareLabel}
        </Text>
      </View>
      <Text style={[styles.summaryValue, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>
        {formatCurrency(item.price, hideAmounts)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerAction: { fontSize: 14, width: 52 },
  headerTitle: { flex: 1, fontSize: 17, textAlign: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  body: { padding: 16, gap: 16 },
  photo: { width: '100%', aspectRatio: 3 / 4, borderRadius: 18 },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  photoPlaceholderText: { fontSize: 13 },
  card: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 4 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, gap: 12 },
  merchant: { fontSize: 16 },
  summaryMeta: { fontSize: 12, marginTop: 2 },
  myShare: { fontSize: 17 },
  summaryLabel: { fontSize: 13 },
  summaryValue: { fontSize: 13 },
  divider: { height: StyleSheet.hairlineWidth },
  sectionLabel: { fontSize: 11, letterSpacing: 0.6, marginBottom: -6 },
  itemName: { fontSize: 14 },
  itemMeta: { fontSize: 12, marginTop: 2 },
})
