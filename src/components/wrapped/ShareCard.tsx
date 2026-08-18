import { useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import type { WrappedData } from '@/src/api/wrapped'
import { formatCurrency } from '@/src/lib/format'
import { fontFamily } from '@/src/theme/fonts'
import { WrappedCard, WrappedBigNumber } from './WrappedCard'

export function ShareCard({ data, color, onColor }: { data: WrappedData; color: string; onColor: string }) {
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
        <WrappedCard color={color} onColor={onColor} eyebrow="🎁 That's a wrap">
          <View style={{ gap: 18 }}>
            <WrappedBigNumber value={formatCurrency(data.totalSpent)} onColor={onColor} />
            <Text style={[styles.line, { color: onColor, fontFamily: fontFamily.bodySemiBold }]}>
              {data.totalTransactions} transactions tracked
            </Text>
            {top && (
              <Text style={[styles.line, { color: onColor, fontFamily: fontFamily.bodySemiBold }]}>
                Top category: {top.category}
              </Text>
            )}
            {data.biggestPurchase && (
              <Text style={[styles.line, { color: onColor, fontFamily: fontFamily.bodySemiBold }]}>
                Biggest purchase: {formatCurrency(data.biggestPurchase.amountInr)}
              </Text>
            )}
          </View>
        </WrappedCard>
      </View>
      <Pressable
        onPress={handleShare}
        disabled={sharing}
        style={[styles.shareButton, { backgroundColor: onColor }]}
      >
        <Text style={[styles.shareButtonText, { color, fontFamily: fontFamily.bodyBold }]}>
          {sharing ? 'Preparing…' : 'Share your wrapped'}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  line: { fontSize: 16, opacity: 0.92 },
  shareButton: {
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  shareButtonText: { fontSize: 16 },
})
