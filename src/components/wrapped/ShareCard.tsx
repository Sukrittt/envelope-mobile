import { useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import type { WrappedData } from '@/src/api/wrapped'
import { formatCurrency } from '@/src/lib/format'
import { fontFamily } from '@/src/theme/fonts'
import { WrappedCard, WrappedBigNumber } from './WrappedCard'

export function ShareCard({
  data,
  color,
  onColor,
  gradientColors,
  onRestart,
}: {
  data: WrappedData
  color: string
  onColor: string
  gradientColors?: [string, string, string]
  onRestart?: () => void
}) {
  const captureTarget = useRef<View>(null)
  const [sharing, setSharing] = useState(false)

  const top = data.topCategories[0]

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

  return (
    <View style={{ flex: 1 }}>
      <View ref={captureTarget} collapsable={false} style={{ flex: 1 }}>
        <WrappedCard color={color} onColor={onColor} gradientColors={gradientColors} eyebrow="🎁 That's a wrap">
          <View style={{ gap: 18 }}>
            <WrappedBigNumber value={formatCurrency(data.totalSpent)} onColor={onColor} />
            <View style={styles.statGrid}>
              <View style={styles.statCell}>
                <Text style={[styles.statLabel, { color: onColor, fontFamily: fontFamily.bodyExtraBold }]}>TRANSACTIONS</Text>
                <Text style={[styles.statValue, { color: onColor, fontFamily: fontFamily.displaySemiBold }]}>{data.totalTransactions}</Text>
              </View>
              {top && (
                <View style={styles.statCell}>
                  <Text style={[styles.statLabel, { color: onColor, fontFamily: fontFamily.bodyExtraBold }]}>TOP CATEGORY</Text>
                  <Text style={[styles.statValue, { color: onColor, fontFamily: fontFamily.displaySemiBold }]}>
                    {top.category} · {top.pct.toFixed(0)}%
                  </Text>
                </View>
              )}
              {data.longestStreak && (
                <View style={styles.statCell}>
                  <Text style={[styles.statLabel, { color: onColor, fontFamily: fontFamily.bodyExtraBold }]}>STREAK</Text>
                  <Text style={[styles.statValue, { color: onColor, fontFamily: fontFamily.displaySemiBold }]}>{data.longestStreak.days} days 🔥</Text>
                </View>
              )}
              {data.biggestPurchase && (
                <View style={styles.statCell}>
                  <Text style={[styles.statLabel, { color: onColor, fontFamily: fontFamily.bodyExtraBold }]}>BIGGEST HIT</Text>
                  <Text style={[styles.statValue, { color: onColor, fontFamily: fontFamily.displaySemiBold }]}>
                    {formatCurrency(data.biggestPurchase.amountInr)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </WrappedCard>
      </View>
      <View style={{ gap: 10, marginTop: 16 }}>
        <Pressable onPress={handleShare} disabled={sharing} style={[styles.shareButton, { backgroundColor: onColor }]}>
          <Text style={[styles.shareButtonText, { color, fontFamily: fontFamily.bodyBold }]}>
            {sharing ? 'Preparing…' : 'Share your wrapped'}
          </Text>
        </Pressable>
        {onRestart && (
          <Pressable onPress={onRestart} style={[styles.restartButton, { borderColor: `${onColor}66` }]}>
            <Text style={[styles.restartButtonText, { color: onColor, fontFamily: fontFamily.bodyExtraBold }]}>Watch it again</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  statCell: { width: '45%', gap: 3 },
  statLabel: { fontSize: 10, letterSpacing: 1, opacity: 0.8 },
  statValue: { fontSize: 18 },
  shareButton: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  shareButtonText: { fontSize: 16 },
  restartButton: { borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1 },
  restartButtonText: { fontSize: 13 },
})
