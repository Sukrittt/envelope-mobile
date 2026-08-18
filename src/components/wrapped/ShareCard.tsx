import { useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import type { WrappedData } from '@/src/api/wrapped'
import { formatCurrency } from '@/src/lib/format'
import { fontFamily } from '@/src/theme/fonts'
import { WrappedCard, WRise } from './WrappedCard'
import { getArchetype } from './WrappedCards'

// Matches WrappedScreen's END_GRADIENT — kept local to avoid a circular import
// (WrappedScreen already imports ShareCard).
const SHARE_GRADIENT: [string, string, string] = ['#5055d3', '#9d2398', '#c55123']

export function ShareCard({
  data,
  onColor,
  onRestart,
}: {
  data: WrappedData
  onColor: string
  onRestart?: () => void
}) {
  const captureTarget = useRef<View>(null)
  const [sharing, setSharing] = useState(false)

  const top = data.topCategories[0]
  const archetype = getArchetype(data)
  const archetypeName = archetype.title.replace(/^The\s+/, '')

  async function handleShare() {
    if (!captureTarget.current || sharing) return
    setSharing(true)
    try {
      const uri = await captureRef(captureTarget, { format: 'png', quality: 1 })
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png' })
      }
    } catch {
      // Silently ignore — a failed share/capture isn't worth surfacing an error UI over.
    } finally {
      setSharing(false)
    }
  }

  const rows: Array<[string, string]> = [
    ['Total spent', formatCurrency(data.totalSpent)],
    ['Transactions', `${data.totalTransactions}`],
  ]
  if (top) rows.push(['Top category', `${top.category} · ${top.pct.toFixed(0)}%`])
  if (data.longestStreak) rows.push(['Longest streak', `${data.longestStreak.days} days 🔥`])

  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <View ref={captureTarget} collapsable={false}>
        {/* Needs its own opaque gradient fill: captureRef only captures this subtree, so if it
            were transparent (relying on WrappedScreen's full-bleed gradient behind it) the
            shared PNG would come out with no background at all. */}
        <WrappedCard
          color="transparent"
          onColor={onColor}
          gradientColors={SHARE_GRADIENT}
          eyebrow="🎁 That's a wrap"
          style={styles.shareCard}
        >
          <WRise delay={60}>
            <Text style={[styles.headline, { color: onColor, fontFamily: fontFamily.displayBold }]}>
              {data.range.daysTracked} days, one {archetypeName}.
            </Text>
          </WRise>
          <WRise delay={180}>
            <View style={[styles.panel, { backgroundColor: `${onColor}18`, borderColor: `${onColor}33` }]}>
              {rows.map(([label, value], i) => (
                <View key={label} style={[styles.statRow, i > 0 && { borderTopColor: `${onColor}22`, borderTopWidth: 1 }]}>
                  <Text style={[styles.statLabel, { color: onColor, fontFamily: fontFamily.bodySemiBold }]}>{label}</Text>
                  <Text style={[styles.statValue, { color: onColor, fontFamily: fontFamily.bodyExtraBold }]}>{value}</Text>
                </View>
              ))}
            </View>
          </WRise>
        </WrappedCard>
      </View>
      <WRise delay={260} style={{ gap: 10, marginTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
        <Pressable onPress={handleShare} disabled={sharing} style={[styles.shareButton, { backgroundColor: onColor }]}>
          <Text style={[styles.shareButtonText, { fontFamily: fontFamily.bodyBlack }]}>
            {sharing ? 'Preparing…' : 'Share your wrapped'}
          </Text>
        </Pressable>
        {onRestart && (
          <Pressable onPress={onRestart} style={[styles.restartButton, { borderColor: `${onColor}66` }]}>
            <Text style={[styles.restartButtonText, { color: onColor, fontFamily: fontFamily.bodyExtraBold }]}>Watch it again</Text>
          </Pressable>
        )}
      </WRise>
    </View>
  )
}

const styles = StyleSheet.create({
  shareCard: { flex: 0 },
  headline: { fontSize: 30, lineHeight: 34, letterSpacing: -0.5, marginBottom: 18 },
  panel: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 16 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  statLabel: { fontSize: 14, opacity: 0.85 },
  statValue: { fontSize: 15 },
  shareButton: { borderRadius: 100, paddingVertical: 16, alignItems: 'center' },
  shareButtonText: { fontSize: 16, color: '#120a1f' },
  restartButton: { borderRadius: 100, paddingVertical: 14, alignItems: 'center', borderWidth: 1 },
  restartButtonText: { fontSize: 13 },
})
