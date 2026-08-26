import { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
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
import { ArrowDown } from 'lucide-react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { useUser } from '@/src/hooks/useUser'
import { useExpenses } from '@/src/hooks/useExpenses'
import { FloatingNav, NAV_HREF, activeRouteFor, addSlotShift } from './FloatingNav'

/**
 * The tabs' instance of the floating nav. It reads the active route from the
 * pathname rather than from BottomTabBarProps, because it renders as an overlay
 * sibling of the navigator (see app/(tabs)/_layout.tsx) — which is also what
 * lets the log-expense screen, outside the tab navigator, render the same nav.
 */
export function TabBar() {
  const router = useRouter()
  const userQ = useUser()
  const expensesQ = useExpenses()
  const pathname = usePathname()
  const activeName = activeRouteFor(pathname)

  // Coach mark only after onboarding is confirmed done AND the expense list
  // has loaded empty. Either query loading or failing => hidden (no flash,
  // no false positive for signed-out/error states). Also hidden off the Home
  // tab and behind the log-expense screen so it doesn't linger elsewhere.
  const showFirstExpenseHint =
    !!userQ.data?.onboardedAt &&
    expensesQ.isSuccess &&
    (expensesQ.data?.length ?? 0) === 0 &&
    activeName === 'index' &&
    pathname !== '/modals/log-expense'

  return (
    <FloatingNav
      active={activeName}
      onSelect={(name) => router.navigate(NAV_HREF[name])}
      onAdd={() => router.push('/modals/log-expense')}
    >
      <FirstExpenseHint
        show={showFirstExpenseHint}
        onPress={() => router.push('/modals/log-expense')}
        shiftX={addSlotShift(activeName)}
      />
    </FloatingNav>
  )
}

// "Log your first expense here" pill + bobbing arrow pointing at the + button.
// Only shown once onboarding is complete and no expense has been logged yet
// (server-derived, so it survives restarts and disappears the moment the first
// expense exists). The pill stays centred on the active slot; only the arrow
// shifts to keep pointing at the add slot as the carousel moves.
function FirstExpenseHint({ show, onPress, shiftX }: { show: boolean; onPress: () => void; shiftX: number }) {
  const { tokens, radius, space } = useTheme()
  const [mounted, setMounted] = useState(show)
  // entrance: 0 -> 1 fade/scale/slide-up on show, reverse on hide (unmounts after finishing).
  const entrance = useSharedValue(show ? 1 : 0)
  // bob: translateY 0 -> 9px, opacity .85 -> 1, 1.5s ease-in-out loop.
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
    transform: [{ translateY: bob.value * 9 }, { translateX: shiftX }],
    opacity: 0.85 + bob.value * 0.15,
  }))

  if (!mounted) return null

  return (
    <Pressable onPress={onPress} style={styles.anchor} pointerEvents="box-none" hitSlop={6}>
      <Reanimated.View style={[styles.wrap, { gap: space.xs }, containerStyle]} pointerEvents="box-none">
        <View style={[styles.pill, { backgroundColor: tokens.text, borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: 15 }]}>
          <Text style={[styles.label, { color: tokens.bg, fontFamily: fontFamily.bodyExtraBold }]}>Log your first expense here</Text>
        </View>
        <Reanimated.View style={arrowStyle} pointerEvents="none">
          <ArrowDown size={22} color={tokens.text} strokeWidth={2.4} />
        </Reanimated.View>
      </Reanimated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', bottom: '100%', left: 0, right: 0, alignItems: 'center', zIndex: 10, elevation: 10 },
  wrap: { alignItems: 'center' },
  pill: {},
  label: { fontSize: 12 },
})
