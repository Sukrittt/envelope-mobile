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
import { FloatingNav, NAV_HREF, LOG_EXPENSE_PATH, navStateFor, addSlotShift, type NavRoute } from './FloatingNav'

/**
 * The app's single nav instance, mounted once above the root Stack (see
 * app/_layout.tsx) so it survives every push — including log-expense —
 * instead of unmounting/remounting and cutting between states. Nav state
 * (which slot is active, whether the nav shows at all) is derived purely
 * from the pathname via navStateFor.
 */
export function TabBar() {
  const router = useRouter()
  const pathname = usePathname()
  const { active, addActive, visible } = navStateFor(pathname)

  const visibility = useSharedValue(visible ? 1 : 0)
  useEffect(() => {
    visibility.value = withTiming(visible ? 1 : 0, { duration: 160 })
  }, [visible, visibility])
  const visibilityStyle = useAnimatedStyle(() => ({ opacity: visibility.value }))

  return (
    <Reanimated.View style={[StyleSheet.absoluteFill, visibilityStyle]} pointerEvents={visible ? 'box-none' : 'none'}>
      <FloatingNav
        active={active}
        addActive={addActive}
        variant={addActive ? 'onAccent' : 'default'}
        onSelect={(name) => (addActive ? router.replace(NAV_HREF[name]) : router.navigate(NAV_HREF[name]))}
        onAdd={() => (addActive ? router.back() : router.push(LOG_EXPENSE_PATH))}
      >
        {visible ? <FirstExpenseHintGate active={active} /> : null}
      </FloatingNav>
    </Reanimated.View>
  )
}

// Queries only fire while the nav is actually showing (inside the tabs or on
// log-expense) — mounting them at the root would fetch /api/user and
// /api/expenses even while signed out.
function FirstExpenseHintGate({ active }: { active: NavRoute | null }) {
  const router = useRouter()
  const pathname = usePathname()
  const userQ = useUser()
  const expensesQ = useExpenses()

  // Coach mark only after onboarding is confirmed done AND the expense list
  // has loaded empty. Either query loading or failing => hidden (no flash,
  // no false positive for signed-out/error states). Also hidden off the Home
  // tab and behind the log-expense screen so it doesn't linger elsewhere.
  const show =
    !!userQ.data?.onboardedAt &&
    expensesQ.isSuccess &&
    (expensesQ.data?.length ?? 0) === 0 &&
    active === 'index' &&
    pathname !== LOG_EXPENSE_PATH

  return (
    <FirstExpenseHint show={show} onPress={() => router.push(LOG_EXPENSE_PATH)} shiftX={addSlotShift(active)} />
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mixed effect: the hide branch below waits on withTiming's finish callback, an external animation system
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
