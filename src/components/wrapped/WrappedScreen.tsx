import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, PanResponder, View, Text, Pressable, StyleSheet } from 'react-native'
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

interface CardDef {
  Component: (props: { data: WrappedData; color: string; onColor: string }) => React.ReactElement | null
  isVisible: (data: WrappedData) => boolean
}

// isVisible mirrors each card's own null-guard — kept separate so filtering
// never has to invoke a component (ShareCard uses hooks; calling components
// as plain functions outside render breaks Rules of Hooks).
const CARDS: CardDef[] = [
  { Component: IntroCard, isVisible: () => true },
  { Component: TotalSpentCard, isVisible: () => true },
  { Component: TopCategoryCard, isVisible: (d) => d.topCategories.length > 0 },
  { Component: BiggestPurchaseCard, isVisible: (d) => d.biggestPurchase !== null },
  { Component: TopWeekdayCard, isVisible: (d) => d.topWeekday !== null },
  { Component: CategoryBreakdownCard, isVisible: (d) => d.topCategories.reduce((s, c) => s + c.total, 0) > 0 },
  { Component: StreakCard, isVisible: (d) => d.longestStreak !== null },
  { Component: ShareCard, isVisible: () => true },
]

const ACCENT_KEYS = ['gold', 'mint', 'coral', 'violet', 'blue', 'warn'] as const
const CARD_DURATION_MS = 5000
const SWIPE_DOWN_CLOSE_THRESHOLD = 80

export function WrappedScreen() {
  const router = useRouter()
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const { data, isLoading, error } = useWrapped()

  const [index, setIndex] = useState(0)
  const opacity = useRef(new Animated.Value(1)).current
  const progress = useRef(new Animated.Value(0)).current

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_, g) => {
        if (g.dy > SWIPE_DOWN_CLOSE_THRESHOLD) router.back()
      },
    }),
  ).current

  // Skip cards a near-empty dataset can't back (e.g. no biggest-purchase row).
  const visibleCards = useMemo(() => {
    if (!data) return []
    return CARDS.map((card, i) => ({ ...card, colorKey: ACCENT_KEYS[i % ACCENT_KEYS.length] })).filter((card) =>
      card.isVisible(data),
    )
  }, [data])

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.ease), useNativeDriver: true }).start()
  }, [index])

  // Story-style top bar: current segment fills over CARD_DURATION_MS, then auto-advances.
  useEffect(() => {
    if (visibleCards.length === 0) return
    progress.setValue(0)
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: CARD_DURATION_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    })
    anim.start(({ finished }) => {
      if (finished) goTo(index + 1)
    })
    return () => anim.stop()
  }, [index, visibleCards.length])

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

  const { Component: Card, colorKey } = visibleCards[index]
  const color = tokens[colorKey]
  const onColor = tokens.onAccent

  return (
    <View style={[styles.container, { backgroundColor: color, paddingTop: insets.top }]} {...panResponder.panHandlers}>
      <View style={styles.progressRow}>
        {visibleCards.map((_, i) => (
          <View key={i} style={[styles.progressTrack, { backgroundColor: `${onColor}33` }]}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  backgroundColor: onColor,
                  width:
                    i < index
                      ? '100%'
                      : i === index
                        ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                        : '0%',
                },
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
