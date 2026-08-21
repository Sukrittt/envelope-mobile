import { useEffect, useRef, useState } from 'react'
import { Animated, View, Text, Pressable, StyleSheet } from 'react-native'
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

  const scales = useRef({
    index: new Animated.Value(1),
    activity: new Animated.Value(1),
    envelopes: new Animated.Value(1),
    more: new Animated.Value(1),
  }).current

  const bounce = (name: keyof typeof scales) => {
    const scale = scales[name]
    scale.setValue(0.85)
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 8, stiffness: 220 }).start()
  }

  const renderTab = (name: 'index' | 'activity' | 'envelopes' | 'more') => {
    const route = byName(name)
    if (!route) return null
    const focused = state.routes[state.index]?.key === route.key
    const color = focused ? tokens.gold : tokens.text2
    const TabIcon = TAB_ICON[name]

    return (
      <Pressable
        key={route.key}
        onPress={() => {
          bounce(name)
          navigation.navigate(route.name)
        }}
        style={styles.tab}
      >
        <Animated.View style={{ alignItems: 'center', gap: 3, transform: [{ scale: scales[name] }] }}>
          <TabIcon size={24} color={color} strokeWidth={2} />
          <Text style={[styles.label, { color, fontFamily: fontFamily.displayMedium }]}>{TAB_LABEL[name]}</Text>
        </Animated.View>
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
      {renderTab('index')}
      {renderTab('activity')}
      <Pressable onPress={() => router.push('/modals/log-expense')} style={styles.addTab}>
        <View style={[styles.addButton, { backgroundColor: tokens.gold }]}>
          <Plus size={24} color={tokens.onAccent} strokeWidth={2} />
        </View>
      </Pressable>
      {renderTab('envelopes')}
      {renderTab('more')}
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
  addButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
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
