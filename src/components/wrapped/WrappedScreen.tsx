import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, View, Text, Pressable, StyleSheet } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { useWrapped } from '@/src/hooks/useWrapped'
import { useBudgets } from '@/src/hooks/useBudgets'
import { useWrappedMusic } from '@/src/hooks/useWrappedMusic'
import { LoadingCaption } from '@/src/components/shared/LoadingCaption'
import {
  CoverCard,
  IntroCard,
  TotalSpentCard,
  TopCategoryCard,
  BiggestPurchaseCard,
  TopWeekdayCard,
  MonthRaceCard,
  CategoryBreakdownCard,
  StreakCard,
  BadgesCard,
  ArchetypeCard,
} from './WrappedCards'
import { ShareCard } from './ShareCard'
import type { WrappedData } from '@/src/api/wrapped'

const CARD_DURATION_MS = 5000
const SWIPE_DOWN_CLOSE_DISTANCE = 120
const SWIPE_DOWN_CLOSE_VELOCITY = 800
/** progress row (10 + 3) + top bar (10 + 30) — cards start below it so the eyebrow never collides. */
const OVERLAY_HEIGHT = 53
const END_GRADIENT: [string, string, string] = ['#5055d3', '#9d2398', '#c55123']

interface Slide {
  bg: string
  text: string
  gradient?: [string, string, string]
  visible: boolean
  render: () => React.ReactElement
}

function buildSlides(
  data: WrappedData,
  moneySaved: number | undefined,
  begin: (muted: boolean) => void,
  restart: () => void,
): Slide[] {
  return [
    {
      bg: '#cd7d00',
      text: '#2e1200',
      visible: true,
      render: () => (
        <CoverCard data={data} color="#cd7d00" onColor="#2e1200" onStart={() => begin(false)} onStartMuted={() => begin(true)} />
      ),
    },
    { bg: '#4b4fcc', text: '#ffffff', visible: true, render: () => <IntroCard data={data} color="#4b4fcc" onColor="#ffffff" /> },
    { bg: '#008140', text: '#ffffff', visible: true, render: () => <TotalSpentCard data={data} color="#008140" onColor="#ffffff" /> },
    {
      bg: '#c91f3a',
      text: '#ffffff',
      visible: data.topCategories.length > 0,
      render: () => <TopCategoryCard data={data} color="#c91f3a" onColor="#ffffff" />,
    },
    {
      bg: '#ad2ca7',
      text: '#ffffff',
      visible: data.biggestPurchase !== null,
      render: () => <BiggestPurchaseCard data={data} color="#ad2ca7" onColor="#ffffff" />,
    },
    {
      bg: '#008097',
      text: '#ffffff',
      visible: data.topWeekday !== null,
      render: () => <TopWeekdayCard data={data} color="#008097" onColor="#ffffff" />,
    },
    {
      bg: '#43368e',
      text: '#ffffff',
      visible: (data.monthlyTotals?.length ?? 0) > 0,
      render: () => <MonthRaceCard data={data} color="#43368e" onColor="#ffffff" />,
    },
    {
      bg: '#c87600',
      text: '#2b1000',
      visible: data.topCategories.reduce((s, c) => s + c.total, 0) > 0,
      render: () => <CategoryBreakdownCard data={data} color="#c87600" onColor="#2b1000" />,
    },
    {
      bg: '#007a3a',
      text: '#ffffff',
      visible: data.longestStreak !== null,
      render: () => <StreakCard data={data} color="#007a3a" onColor="#ffffff" moneySaved={moneySaved} />,
    },
    { bg: '#a624a0', text: '#ffffff', visible: true, render: () => <BadgesCard data={data} color="#a624a0" onColor="#ffffff" /> },
    { bg: '#c11435', text: '#ffffff', visible: true, render: () => <ArchetypeCard data={data} color="#c11435" onColor="#ffffff" /> },
    {
      bg: '#5055d3',
      text: '#ffffff',
      gradient: END_GRADIENT,
      visible: true,
      render: () => (
        <ShareCard data={data} color="#5055d3" onColor="#ffffff" gradientColors={END_GRADIENT} onRestart={restart} />
      ),
    },
  ].filter((s) => s.visible)
}

export function WrappedScreen() {
  const router = useRouter()
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const { data, isLoading, error } = useWrapped()
  const { data: budgets } = useBudgets()

  const [index, setIndex] = useState(0)
  const [started, setStarted] = useState(false)
  const [muted, setMuted] = useState(true)
  const [paused, setPaused] = useState(false)
  const [hint, setHint] = useState<'prev' | 'next' | 'play' | null>(null)
  const opacity = useRef(new Animated.Value(1)).current
  const progress = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(0)).current
  const hintOpacity = useRef(new Animated.Value(0)).current

  useWrappedMusic(started && !muted)

  const moneySaved = useMemo(() => {
    if (!data || !budgets || budgets.length === 0) return undefined
    const startMonth = data.range.startDate.slice(0, 7)
    const endMonth = data.range.endDate.slice(0, 7)
    const assigned = budgets
      .filter((b) => b.month >= startMonth && b.month <= endMonth)
      .reduce((s, b) => s + (Number(b.assigned) || 0) + (Number(b.rolled_over) || 0), 0)
    const saved = assigned - data.totalSpent
    return saved > 0 ? saved : undefined
  }, [data, budgets])

  function begin(startMuted: boolean) {
    setMuted(startMuted)
    setStarted(true)
    setIndex(1)
  }

  function restart() {
    setStarted(false)
    setIndex(0)
  }

  function setDragY(y: number) {
    translateY.setValue(Math.max(0, y))
  }

  function snapBack() {
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start()
  }

  function close() {
    router.back()
  }

  const slides = useMemo(() => (data ? buildSlides(data, moneySaved, begin, restart) : []), [data, moneySaved])

  // Vertical-only + a real offset before activating, so this never steals
  // taps from the tap-zone Pressables underneath (RNGH negotiates the two
  // since GestureHandlerRootView wraps the whole app in _layout.tsx).
  const swipeDownGesture = Gesture.Pan()
    .activeOffsetY(15)
    .failOffsetX([-20, 20])
    .onUpdate((e) => {
      runOnJS(setDragY)(e.translationY)
    })
    .onEnd((e) => {
      if (e.translationY > SWIPE_DOWN_CLOSE_DISTANCE || e.velocityY > SWIPE_DOWN_CLOSE_VELOCITY) {
        runOnJS(close)()
      } else {
        runOnJS(snapBack)()
      }
    })

  function flashHint(kind: 'prev' | 'next' | 'play') {
    setHint(kind)
    hintOpacity.setValue(1)
    Animated.timing(hintOpacity, { toValue: 0, duration: 500, delay: 200, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setHint(null)
    })
  }

  function tapSide(dir: 1 | -1) {
    if (goTo(index + dir)) flashHint(dir === 1 ? 'next' : 'prev')
  }

  function tapCenter() {
    const next = !paused
    setPaused(next)
    if (!next) flashHint('play')
  }

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.ease), useNativeDriver: true }).start()
  }, [index])

  // Story-style top bar: current segment fills over CARD_DURATION_MS, then auto-advances.
  useEffect(() => {
    if (!started || slides.length === 0) return
    if (paused) return
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
  }, [index, started, slides.length, paused])

  function goTo(next: number) {
    if (!started || next === index || next < 1 || next >= slides.length) return false
    opacity.setValue(0)
    setIndex(next)
    return true
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

  if (error || slides.length === 0) {
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

  const slide = slides[index]
  const contentSlides = slides.slice(1)

  return (
    <GestureDetector gesture={swipeDownGesture}>
      <Animated.View
        style={[styles.container, { backgroundColor: slide.bg, paddingTop: insets.top, transform: [{ translateY }] }]}
      >
        {/* Tap zones sit under the card so real interactive children (ShareCard's button,
            CoverCard's start buttons) still win the touch. */}
        {started && (
          <View style={styles.tapZoneRow}>
            <Pressable style={styles.tapZoneSide} onPress={() => tapSide(-1)} />
            <Pressable style={styles.tapZoneCenter} onPress={tapCenter} />
            <Pressable style={styles.tapZoneSide} onPress={() => tapSide(1)} />
          </View>
        )}

        {/* box-none: this wrapper never claims taps itself, so the tap zones behind it still
            work everywhere except where a real interactive child (e.g. ShareCard's button) is. */}
        <Animated.View
          pointerEvents="box-none"
          style={[styles.cardWrap, { opacity, paddingTop: started ? OVERLAY_HEIGHT : 0, paddingBottom: insets.bottom + 24 }]}
        >
          {slide.render()}
        </Animated.View>

        {started && (
          <View pointerEvents="box-none" style={[styles.overlayControls, { top: insets.top }]}>
            <View style={styles.progressRow}>
              {contentSlides.map((_, i) => {
                const slideIndex = i + 1
                return (
                  <View key={i} style={[styles.progressTrack, { backgroundColor: `${slide.text}33` }]}>
                    <Animated.View
                      style={[
                        styles.progressFill,
                        {
                          backgroundColor: slide.text,
                          width:
                            slideIndex < index
                              ? '100%'
                              : slideIndex === index
                                ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                                : '0%',
                        },
                      ]}
                    />
                  </View>
                )
              })}
            </View>

            <View style={styles.topBar}>
              <Text style={[styles.topBarLabel, { color: `${slide.text}dd` }]}>EXPENSE WRAPPED</Text>
              <View style={styles.topBarButtons}>
                <Pressable onPress={() => setMuted((m) => !m)} hitSlop={8} style={styles.iconButton}>
                  <Text style={styles.iconButtonText}>{muted ? '🔇' : '♫'}</Text>
                </Pressable>
                <Pressable onPress={close} hitSlop={8} style={styles.iconButton}>
                  <Text style={styles.iconButtonText}>✕</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {started && paused && (
          <View pointerEvents="none" style={styles.centerIndicator}>
            <View style={[styles.indicatorBubble, { borderColor: `${slide.text}55` }]}>
              <Text style={[styles.indicatorIcon, { color: slide.text }]}>❚❚</Text>
            </View>
          </View>
        )}

        {started && hint === 'play' && (
          <Animated.View pointerEvents="none" style={[styles.centerIndicator, { opacity: hintOpacity }]}>
            <View style={[styles.indicatorBubble, { borderColor: `${slide.text}55` }]}>
              <Text style={[styles.indicatorIcon, { color: slide.text }]}>▶</Text>
            </View>
          </Animated.View>
        )}

        {started && (hint === 'prev' || hint === 'next') && (
          <Animated.View
            pointerEvents="none"
            style={[styles.sideIndicator, hint === 'prev' ? styles.sideIndicatorLeft : styles.sideIndicatorRight, { opacity: hintOpacity }]}
          >
            <View style={[styles.indicatorBubble, { borderColor: `${slide.text}55` }]}>
              <Text style={[styles.indicatorIcon, { color: slide.text }]}>{hint === 'prev' ? '❮' : '❯'}</Text>
            </View>
          </Animated.View>
        )}
      </Animated.View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  errorText: { fontSize: 14, textAlign: 'center' },
  overlayControls: { position: 'absolute', left: 0, right: 0 },
  progressRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingTop: 10 },
  progressTrack: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10 },
  topBarButtons: { flexDirection: 'row', gap: 8 },
  topBarLabel: { fontSize: 10, letterSpacing: 2, fontWeight: '800' },
  centerIndicator: { position: 'absolute', top: '44%', left: 0, right: 0, alignItems: 'center' },
  sideIndicator: { position: 'absolute', top: '44%' },
  sideIndicatorLeft: { left: 24 },
  sideIndicatorRight: { right: 24 },
  indicatorBubble: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1.5,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorIcon: { fontSize: 24, lineHeight: 28 },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonText: { fontSize: 13, color: '#fff' },
  closeText: { fontSize: 18 },
  cardWrap: { flex: 1 },
  tapZoneRow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' },
  tapZoneSide: { flex: 3 },
  tapZoneCenter: { flex: 4 },
})
