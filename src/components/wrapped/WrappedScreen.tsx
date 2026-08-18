import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, View, Text, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { useWrapped } from '@/src/hooks/useWrapped'
import { LoadingCaption } from '@/src/components/shared/LoadingCaption'
import {
  IntroCard,
  TotalSpentCard,
  TopCategoryCard,
  BiggestPurchaseCard,
  TopWeekdayCard,
  CategoryBreakdownCard,
  StreakCard,
} from './WrappedCards'
import { ShareCard } from './ShareCard'
import type { WrappedData } from '@/src/api/wrapped'

const CARDS: Array<(props: { data: WrappedData; color: string; onColor: string }) => React.ReactElement | null> = [
  IntroCard,
  TotalSpentCard,
  TopCategoryCard,
  BiggestPurchaseCard,
  TopWeekdayCard,
  CategoryBreakdownCard,
  StreakCard,
  ShareCard,
]

const ACCENT_KEYS = ['gold', 'mint', 'coral', 'violet', 'blue', 'warn'] as const

export function WrappedScreen() {
  const router = useRouter()
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const { data, isLoading, error } = useWrapped()

  const [index, setIndex] = useState(0)
  const opacity = useRef(new Animated.Value(1)).current

  // Skip cards a near-empty dataset can't back (e.g. no biggest-purchase row).
  const visibleCards = useMemo(() => {
    if (!data) return []
    return CARDS.map((Card, i) => ({ Card, colorKey: ACCENT_KEYS[i % ACCENT_KEYS.length] })).filter(({ Card }) =>
      Card({ data, color: '', onColor: '' }) !== null,
    )
  }, [data])

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.ease), useNativeDriver: true }).start()
  }, [index])

  function goTo(next: number) {
    if (next === index || next < 0 || next >= visibleCards.length) return
    opacity.setValue(0)
    setIndex(next)
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: tokens.bg, paddingTop: insets.top }]}>
        <View style={styles.centerFill}>
          <LoadingCaption />
        </View>
      </View>
    )
  }

  if (error || visibleCards.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: tokens.bg, paddingTop: insets.top }]}>
        <View style={styles.centerFill}>
          <Text style={[styles.errorText, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
            {error instanceof Error ? error.message : 'Not enough expenses yet for a Wrapped recap.'}
          </Text>
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginTop: 16 }}>
            <Text style={[styles.closeText, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>Close</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  const { Card, colorKey } = visibleCards[index]
  const color = tokens[colorKey]
  const onColor = tokens.onAccent

  return (
    <View style={[styles.container, { backgroundColor: color, paddingTop: insets.top }]}>
      <View style={styles.progressRow}>
        {visibleCards.map((_, i) => (
          <View key={i} style={[styles.progressTrack, { backgroundColor: `${onColor}33` }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: onColor, width: i < index ? '100%' : i === index ? '100%' : '0%' },
              ]}
            />
          </View>
        ))}
      </View>

      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closeButton}>
        <Text style={[styles.closeText, { color: onColor }]}>✕</Text>
      </Pressable>

      <View style={styles.tapZones}>
        <Pressable style={styles.tapZoneLeft} onPress={() => goTo(index - 1)} />
        <Pressable style={styles.tapZoneRight} onPress={() => goTo(index + 1)} />
      </View>

      {/* box-none: this wrapper never claims taps itself, so the tap zones behind it still
          work everywhere except where a real interactive child (e.g. ShareCard's button) is. */}
      <Animated.View
        pointerEvents="box-none"
        style={[styles.cardWrap, { opacity, paddingBottom: insets.bottom + 24 }]}
      >
        <Card data={data!} color={color} onColor={onColor} />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  errorText: { fontSize: 14, textAlign: 'center' },
  progressRow: { flexDirection: 'row', gap: 4, paddingLeft: 12, paddingRight: 44, paddingTop: 12 },
  progressTrack: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  closeButton: { position: 'absolute', top: 14, right: 14, zIndex: 10, padding: 8 },
  closeText: { fontSize: 18 },
  cardWrap: { flex: 1, padding: 16 },
  tapZones: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' },
  tapZoneLeft: { flex: 1 },
  tapZoneRight: { flex: 2 },
})
