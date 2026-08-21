import { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, usePathname } from 'expo-router'
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  runOnJS,
  Easing,
  type SharedValue,
} from 'react-native-reanimated'
import type { BottomTabBarProps } from 'expo-router/js-tabs'
import { House, ReceiptText, Tags, CircleUser, Plus, ArrowDown, type LucideIcon } from 'lucide-react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { useUser } from '@/src/hooks/useUser'
import { useExpenses } from '@/src/hooks/useExpenses'

const TAB_ICON: Record<string, LucideIcon> = {
  index: House,
  activity: ReceiptText,
  envelopes: Tags,
  more: CircleUser,
}

const TAB_LABEL: Record<string, string> = {
  index: 'Home',
  activity: 'Activity',
  envelopes: 'Envelopes',
  more: 'More',
}

// Bouncy overshoot motion, ported from Tab Bar Motion.dc.html (32%/30%/38% keyframe split of a 620ms cycle).
const BOUNCE_EASE = Easing.bezier(0.3, 1.2, 0.4, 1)
const SEG_A = { duration: 0.32 * 620, easing: BOUNCE_EASE }
const SEG_B = { duration: 0.3 * 620, easing: BOUNCE_EASE }
const SEG_C = { duration: 0.38 * 620, easing: BOUNCE_EASE }
const RING_OUT = { duration: 620, easing: Easing.out(Easing.ease) }
const SPARK_OUT = { duration: 600, easing: Easing.out(Easing.ease) }

type RingValues = { opacity: SharedValue<number>; scale: SharedValue<number> }

function useRing(): RingValues {
  return { opacity: useSharedValue(0), scale: useSharedValue(0.35) }
}

function useRingStyle(ring: RingValues) {
  return useAnimatedStyle(() => ({
    opacity: ring.opacity.value,
    transform: [{ scale: ring.scale.value }],
  }))
}

function useLabelStyle(y: SharedValue<number>) {
  return useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }))
}

/**
 * Custom tab bar matching the dc.html prototype's mobile nav exactly:
 * Home / Activity / (+Add, not a route — opens the log-expense modal) / Envelopes / More.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const userQ = useUser()
  const expensesQ = useExpenses()
  const pathname = usePathname()

  // Coach mark only after onboarding is confirmed done AND the expense list
  // has loaded empty. Either query loading or failing => hidden (no flash,
  // no false positive for signed-out/error states). Also hidden off the Home
  // tab and behind the log-expense modal so it doesn't linger on other screens.
  const onHomeTab = state.routes[state.index]?.name === 'index'
  const modalOpen = pathname === '/modals/log-expense'
  const showFirstExpenseHint =
    !!userQ.data?.onboardedAt &&
    expensesQ.isSuccess &&
    (expensesQ.data?.length ?? 0) === 0 &&
    onHomeTab &&
    !modalOpen

  const byName = (name: string) => state.routes.find((r) => r.name === name)

  // Home: dip + scale (translateY 0 -> -7 -> 1 -> 0, scale 1 -> 1.14 -> 0.95 -> 1)
  const homeY = useSharedValue(0)
  const homeScale = useSharedValue(1)
  // Activity: card-flip (rotateY 0 -> -92deg -> 0, scale bump at midpoint)
  const activityRotateY = useSharedValue(0)
  const activityScale = useSharedValue(1)
  // Envelopes: pendulum swing (rotate 0 -> -17 -> 11 -> -5 -> 0)
  const envelopesRotate = useSharedValue(0)
  const envelopesScale = useSharedValue(1)
  // More: nod (scale 1 -> 1.18 -> 0.97 -> 1, translateY -3 -> 1 -> 0)
  const moreY = useSharedValue(0)
  const moreScale = useSharedValue(1)

  const ringIndex = useRing()
  const ringActivity = useRing()
  const ringEnvelopes = useRing()
  const ringMore = useRing()

  const labelYIndex = useSharedValue(0)
  const labelYActivity = useSharedValue(0)
  const labelYEnvelopes = useSharedValue(0)
  const labelYMore = useSharedValue(0)

  const homeIconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: homeY.value }, { scale: homeScale.value }],
  }))
  const activityIconStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { rotateY: `${activityRotateY.value}deg` }, { scale: activityScale.value }],
  }))
  const envelopesIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${envelopesRotate.value}deg` }, { scale: envelopesScale.value }],
  }))
  const moreIconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: moreY.value }, { scale: moreScale.value }],
  }))

  const ringStyleIndex = useRingStyle(ringIndex)
  const ringStyleActivity = useRingStyle(ringActivity)
  const ringStyleEnvelopes = useRingStyle(ringEnvelopes)
  const ringStyleMore = useRingStyle(ringMore)

  const labelStyleIndex = useLabelStyle(labelYIndex)
  const labelStyleActivity = useLabelStyle(labelYActivity)
  const labelStyleEnvelopes = useLabelStyle(labelYEnvelopes)
  const labelStyleMore = useLabelStyle(labelYMore)

  // + button: cumulative spin (rotate overshoots 45deg past each 90deg step) + radial spark burst
  const plusRotate = useSharedValue(0)
  const plusScale = useSharedValue(1)
  const plusSparkOpacity = useSharedValue(0)
  const plusSparkScale = useSharedValue(0.4)
  const plusBaseRef = useRef(0)

  const plusIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${plusRotate.value}deg` }, { scale: plusScale.value }],
  }))
  const plusSparkStyle = useAnimatedStyle(() => ({
    opacity: plusSparkOpacity.value,
    transform: [{ scale: plusSparkScale.value }],
  }))

  const triggerRing = (ring: RingValues) => {
    ring.opacity.value = 0.55
    ring.scale.value = 0.35
    ring.opacity.value = withTiming(0, RING_OUT)
    ring.scale.value = withTiming(2.4, RING_OUT)
  }

  const triggerLabel = (y: SharedValue<number>) => {
    y.value = withSequence(withTiming(-2, SEG_A), withTiming(0, { duration: SEG_B.duration + SEG_C.duration, easing: BOUNCE_EASE }))
  }

  const triggerHome = () => {
    triggerRing(ringIndex)
    triggerLabel(labelYIndex)
    homeY.value = withSequence(withTiming(-7, SEG_A), withTiming(1, SEG_B), withTiming(0, SEG_C))
    homeScale.value = withSequence(withTiming(1.14, SEG_A), withTiming(0.95, SEG_B), withTiming(1, SEG_C))
  }

  const triggerActivity = () => {
    triggerRing(ringActivity)
    triggerLabel(labelYActivity)
    const half = { duration: 310, easing: BOUNCE_EASE }
    activityRotateY.value = withSequence(withTiming(-92, half), withTiming(0, half))
    activityScale.value = withSequence(withTiming(1.06, half), withTiming(1, half))
  }

  const triggerEnvelopes = () => {
    triggerRing(ringEnvelopes)
    triggerLabel(labelYEnvelopes)
    envelopesRotate.value = withSequence(
      withTiming(-17, SEG_A),
      withTiming(11, SEG_B),
      withTiming(-5, { duration: SEG_C.duration * 0.6, easing: BOUNCE_EASE }),
      withTiming(0, { duration: SEG_C.duration * 0.4, easing: BOUNCE_EASE }),
    )
    envelopesScale.value = withSequence(withTiming(1.1, SEG_A), withTiming(1, { duration: SEG_B.duration + SEG_C.duration, easing: BOUNCE_EASE }))
  }

  const triggerMore = () => {
    triggerRing(ringMore)
    triggerLabel(labelYMore)
    moreScale.value = withSequence(withTiming(1.18, SEG_A), withTiming(0.97, SEG_B), withTiming(1, SEG_C))
    moreY.value = withSequence(withTiming(-3, SEG_A), withTiming(1, SEG_B), withTiming(0, SEG_C))
  }

  const triggerPlus = () => {
    const from = plusBaseRef.current
    const to = from + 90
    plusBaseRef.current = to
    plusRotate.value = withSequence(withTiming(from + 135, SEG_A), withTiming(to, { duration: SEG_B.duration + SEG_C.duration, easing: BOUNCE_EASE }))
    plusScale.value = withSequence(withTiming(1.16, SEG_A), withTiming(1, { duration: SEG_B.duration + SEG_C.duration, easing: BOUNCE_EASE }))
    plusSparkOpacity.value = 0.7
    plusSparkScale.value = 0.4
    plusSparkOpacity.value = withTiming(0, SPARK_OUT)
    plusSparkScale.value = withTiming(2.9, SPARK_OUT)
  }

  const renderTab = (
    name: 'index' | 'activity' | 'envelopes' | 'more',
    iconStyle: ReturnType<typeof useAnimatedStyle>,
    ringStyle: ReturnType<typeof useAnimatedStyle>,
    labelStyle: ReturnType<typeof useAnimatedStyle>,
    trigger: () => void,
  ) => {
    const route = byName(name)
    if (!route) return null
    const focused = state.routes[state.index]?.key === route.key
    const color = focused ? tokens.gold : tokens.text2
    const TabIcon = TAB_ICON[name]

    return (
      <Pressable
        key={route.key}
        onPress={() => {
          trigger()
          navigation.navigate(route.name)
        }}
        style={styles.tab}
      >
        <View style={{ alignItems: 'center', gap: 3 }}>
          <View style={styles.iconWrap}>
            <Reanimated.View style={[styles.ring, { backgroundColor: tokens.gold }, ringStyle]} pointerEvents="none" />
            <Reanimated.View style={iconStyle}>
              <TabIcon size={24} color={color} strokeWidth={2} />
            </Reanimated.View>
          </View>
          <Reanimated.View style={labelStyle}>
            <Text style={[styles.label, { color, fontFamily: fontFamily.displayMedium }]}>{TAB_LABEL[name]}</Text>
          </Reanimated.View>
        </View>
      </Pressable>
    )
  }

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: tokens.tabbarBg,
          borderTopColor: tokens.borderStrong,
          paddingBottom: 10 + insets.bottom,
        },
      ]}
    >
      {renderTab('index', homeIconStyle, ringStyleIndex, labelStyleIndex, triggerHome)}
      {renderTab('activity', activityIconStyle, ringStyleActivity, labelStyleActivity, triggerActivity)}
      <Pressable
        onPress={() => {
          triggerPlus()
          router.push('/modals/log-expense')
        }}
        style={styles.addTab}
      >
        <View style={styles.plusWrap}>
          <Reanimated.View style={[styles.spark, { backgroundColor: tokens.gold }, plusSparkStyle]} pointerEvents="none" />
          <Reanimated.View style={[styles.addButton, { backgroundColor: tokens.gold }, plusIconStyle]}>
            <Plus size={24} color={tokens.onAccent} strokeWidth={2} />
          </Reanimated.View>
        </View>
      </Pressable>
      {renderTab('envelopes', envelopesIconStyle, ringStyleEnvelopes, labelStyleEnvelopes, triggerEnvelopes)}
      {renderTab('more', moreIconStyle, ringStyleMore, labelStyleMore, triggerMore)}
      <FirstExpenseHint show={showFirstExpenseHint} onPress={() => router.push('/modals/log-expense')} />
    </View>
  )
}

// SetupWizard.dc.html:85-86 — "Log your first expense here" pill + bobbing
// arrow pointing at the + button. Only shown once onboarding is complete and
// no expense has been logged yet (server-derived, so it survives restarts and
// disappears the moment the first expense exists).
function FirstExpenseHint({ show, onPress }: { show: boolean; onPress: () => void }) {
  const { tokens } = useTheme()
  const [mounted, setMounted] = useState(show)
  // entrance: 0 -> 1 fade/scale/slide-up on show, reverse on hide (unmounts after finishing).
  const entrance = useSharedValue(show ? 1 : 0)
  // bobDown: translateY 0 -> 9px, opacity .85 -> 1, 1.5s ease-in-out loop.
  const bob = useSharedValue(0)

  useEffect(() => {
    if (show) {
      setMounted(true)
      entrance.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) })
    } else {
      entrance.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(setMounted)(false)
      })
    }
  }, [show, entrance])

  useEffect(() => {
    if (!mounted) {
      bob.value = 0
      return
    }
    const segment = { duration: 750, easing: Easing.inOut(Easing.ease) }
    bob.value = withRepeat(withSequence(withTiming(1, segment), withTiming(0, segment)), -1, false)
  }, [mounted, bob])

  const containerStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ scale: 0.85 + entrance.value * 0.15 }, { translateY: (1 - entrance.value) * 8 }],
  }))

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value * 9 }],
    opacity: 0.85 + bob.value * 0.15,
  }))

  if (!mounted) return null

  return (
    <Pressable onPress={onPress} style={styles.hintAnchor} pointerEvents="box-none" hitSlop={6}>
      <Reanimated.View style={[styles.hintWrap, containerStyle]} pointerEvents="box-none">
        <View style={[styles.hintPill, { backgroundColor: tokens.text }]}>
          <Text style={[styles.hintLabel, { color: tokens.bg }]}>Log your first expense here</Text>
        </View>
        <Reanimated.View style={arrowStyle} pointerEvents="none">
          <ArrowDown size={22} color={tokens.text} strokeWidth={2.4} />
        </Reanimated.View>
      </Reanimated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingTop: 10,
    paddingHorizontal: 8,
    borderTopWidth: 1,
  },
  tab: { alignItems: 'center', gap: 3, flex: 1 },
  label: { fontSize: 10 },
  addTab: { alignItems: 'center', flex: 1 },
  iconWrap: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 32, height: 32, borderRadius: 16 },
  plusWrap: { width: 46, height: 46, marginTop: -22, alignItems: 'center', justifyContent: 'center' },
  spark: { position: 'absolute', width: 46, height: 46, borderRadius: 23 },
  addButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  hintAnchor: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
    elevation: 10,
  },
  hintWrap: { alignItems: 'center', gap: 4, marginBottom: 72 },
  hintPill: { paddingVertical: 9, paddingHorizontal: 15, borderRadius: 14 },
  hintLabel: { fontSize: 12, fontWeight: '800' },
})
