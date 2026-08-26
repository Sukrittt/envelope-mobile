import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedRef,
  useAnimatedScrollHandler,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { House, ReceiptText, Tags, CircleUser, Plus, X, type LucideIcon } from 'lucide-react-native'
import { useTheme } from '@/src/theme/ThemeProvider'

const AnimatedPressable = Reanimated.createAnimatedComponent(Pressable)

export type NavRoute = 'index' | 'activity' | 'envelopes' | 'more'

/** Rendered left-to-right, with the add button occupying the centre slot. */
export const NAV_ROUTES: { name: NavRoute; icon: LucideIcon; label: string }[] = [
  { name: 'index', icon: House, label: 'Home' },
  { name: 'activity', icon: ReceiptText, label: 'Activity' },
  { name: 'envelopes', icon: Tags, label: 'Envelopes' },
  { name: 'more', icon: CircleUser, label: 'More' },
]

export const NAV_HREF: Record<NavRoute, '/' | '/activity' | '/envelopes' | '/more'> = {
  index: '/',
  activity: '/activity',
  envelopes: '/envelopes',
  more: '/more',
}

/** Which circle to light up for a pathname. Null on any screen outside the tabs. */
export function activeRouteFor(pathname: string): NavRoute | null {
  if (pathname === '/' || pathname === '/index') return 'index'
  const match = NAV_ROUTES.find((r) => pathname === `/${r.name}`)
  return match?.name ?? null
}

type NavSlot = { kind: 'route'; name: NavRoute; icon: LucideIcon; label: string } | { kind: 'add' }

/** Slot order matches NAV_ROUTES, with the add action inserted at the centre. */
const NAV_SLOTS: NavSlot[] = [
  ...NAV_ROUTES.slice(0, 2).map((r) => ({ kind: 'route' as const, ...r })),
  { kind: 'add' as const },
  ...NAV_ROUTES.slice(2).map((r) => ({ kind: 'route' as const, ...r })),
]
const ADD_INDEX = 2

function indexOfRoute(name: NavRoute | null): number {
  if (name == null) return -1
  return NAV_SLOTS.findIndex((s) => s.kind === 'route' && s.name === name)
}

const CIRCLE = 46
const RING_GAP = 3
const RING_WIDTH = 2
const RING_SIZE = CIRCLE + 2 * (RING_GAP + RING_WIDTH)
/** Fixed carousel step: distance between two slot centres. */
const SLOT = 72
const ROW_HEIGHT = RING_SIZE + 8

/** Carousel x-offset that puts slot `i` at the centre of the screen. */
export const slotOffset = (i: number): number => i * SLOT

/** Nearest slot index for a given scroll offset, clamped to the slot range. */
export const indexFromOffset = (x: number, count: number): number =>
  Math.min(count - 1, Math.max(0, Math.round(x / SLOT)))

/** How far (px) the centre "add" slot sits from the given active route's slot. */
export function addSlotShift(active: NavRoute | null): number {
  const routeIndex = indexOfRoute(active)
  return (ADD_INDEX - (routeIndex === -1 ? 0 : routeIndex)) * SLOT
}

/**
 * Detached navigation: free-floating circles laid over the page in a
 * horizontal carousel, with no bar, border or scrim behind them. Content
 * scrolls underneath, so every screen reserves NAV_HEIGHT of bottom padding
 * (see Screen / useNavPadding).
 *
 * The selected slot always sits at screen centre. Dragging the row snaps the
 * nearest slot to centre on release and navigates to it; tapping any circle
 * does the same and glides it to centre.
 *
 * The centre slot is an action, not a destination — logging an expense — but
 * sized and colored like every other circle until pressed, so it doesn't
 * compete with the active route's accent fill.
 */
export function FloatingNav({
  active,
  onSelect,
  onAdd,
  addActive = false,
  variant = 'default',
  children,
}: {
  active: NavRoute | null
  onSelect: (name: NavRoute) => void
  onAdd: () => void
  /** True on the log-expense screen: the add slot becomes "you are here". */
  addActive?: boolean
  /** `onAccent` restyles the nav for the flood screen's accent ground. */
  variant?: 'default' | 'onAccent'
  children?: React.ReactNode
}) {
  const { tokens, space, elevation } = useTheme()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const onAccent = variant === 'onAccent'

  const idle = onAccent ? 'rgba(255, 255, 255, 0.22)' : tokens.cardSolid
  const idleIcon = onAccent ? tokens.onAccent : tokens.text2
  const activeFill = onAccent ? tokens.onAccent : tokens.accent
  const activeIcon = onAccent ? tokens.accent : tokens.onAccent
  const ringColor = onAccent ? tokens.onAccent : tokens.accent

  const activeIndex = addActive ? ADD_INDEX : indexOfRoute(active)

  const scrollRef = useAnimatedRef<Reanimated.ScrollView>()
  const scrollX = useSharedValue(0)
  // Captured once at mount, for the initial contentOffset below.
  const [initialIndex] = useState(() => (activeIndex === -1 ? 0 : activeIndex))
  // Tracks the slot the carousel is actually resting on, so a route change
  // that only mirrors our own snap (see onMomentumScrollEnd) doesn't scroll
  // again, and a real external change (tap, deep link) does.
  const mountedIndexRef = useRef(initialIndex)

  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x
  })

  // Re-centres the carousel whenever the committed slot changes from outside
  // a drag (tap, deep link). A change that only mirrors our own snap (see
  // onMomentumScrollEnd, which updates mountedIndexRef first) is a no-op here.
  useEffect(() => {
    if (activeIndex === -1 || activeIndex === mountedIndexRef.current) return
    mountedIndexRef.current = activeIndex
    scrollRef.current?.scrollTo({ x: slotOffset(activeIndex), animated: true })
  }, [activeIndex, scrollRef])

  // ponytail: selection only fires on momentum end; a drag released with no
  // momentum can settle without firing on some Android builds. Add an
  // onScrollEndDrag fallback if that shows up in testing.
  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = indexFromOffset(e.nativeEvent.contentOffset.x, NAV_SLOTS.length)
      if (idx === mountedIndexRef.current) return
      mountedIndexRef.current = idx
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
      const slot = NAV_SLOTS[idx]
      if (slot.kind === 'add') onAdd()
      else onSelect(slot.name)
    },
    [onAdd, onSelect],
  )

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: insets.bottom + space.sm }]}
    >
      {children}
      <Reanimated.ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={SLOT}
        snapToAlignment="start"
        contentOffset={{ x: slotOffset(initialIndex), y: 0 }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumScrollEnd}
        contentContainerStyle={{ paddingHorizontal: (width - SLOT) / 2, alignItems: 'center' }}
        style={styles.scroll}
      >
        {NAV_SLOTS.map((slot, i) =>
          slot.kind === 'add' ? (
            <NavCircle
              key="add"
              icon={addActive ? X : Plus}
              label={addActive ? 'Close' : 'Log expense'}
              selected={addActive}
              background={addActive ? activeFill : idle}
              color={addActive ? activeIcon : idleIcon}
              ringColor={addActive ? ringColor : undefined}
              onPress={onAdd}
              scrollX={scrollX}
              index={i}
              style={elevation.floating}
            />
          ) : (
            <NavCircle
              key={slot.name}
              icon={slot.icon}
              label={slot.label}
              selected={active === slot.name}
              background={active === slot.name ? activeFill : idle}
              color={active === slot.name ? activeIcon : idleIcon}
              ringColor={active === slot.name ? ringColor : undefined}
              onPress={() => onSelect(slot.name)}
              scrollX={scrollX}
              index={i}
            />
          ),
        )}
      </Reanimated.ScrollView>
    </View>
  )
}

function NavCircle({
  icon: IconComponent,
  label,
  selected,
  background,
  color,
  ringColor,
  onPress,
  scrollX,
  index,
  style,
}: {
  icon: LucideIcon
  label: string
  selected: boolean
  background: string
  color: string
  /** Ring drawn around the circle when selected; omit/undefined for none. */
  ringColor?: string
  onPress: () => void
  scrollX: SharedValue<number>
  index: number
  style?: object
}) {
  const { motion, elevation } = useTheme()
  const pressScale = useSharedValue(1)

  const circleStyle = useAnimatedStyle(() => {
    const t = Math.min(1, Math.abs(scrollX.value / SLOT - index))
    return {
      opacity: 1 - t * 0.35,
      transform: [{ scale: pressScale.value * (1 - t * 0.12) }],
    }
  })

  const ringStyle = useAnimatedStyle(() => {
    const t = Math.min(1, Math.abs(scrollX.value / SLOT - index))
    return { opacity: 1 - t }
  })

  return (
    <View style={styles.slot}>
      <View style={styles.ringBox}>
        {ringColor ? (
          <Reanimated.View pointerEvents="none" style={[styles.ring, { borderColor: ringColor }, ringStyle]} />
        ) : null}
        <AnimatedPressable
          accessibilityRole="tab"
          accessibilityLabel={label}
          accessibilityState={{ selected }}
          hitSlop={{ left: (SLOT - CIRCLE) / 2, right: (SLOT - CIRCLE) / 2, top: 8, bottom: 8 }}
          onPressIn={() => {
            pressScale.value = withSpring(0.88, motion.springTight)
          }}
          onPressOut={() => {
            pressScale.value = withSpring(1, motion.spring)
          }}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
            onPress()
          }}
          style={[
            styles.circle,
            { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, backgroundColor: background },
            selected ? elevation.floating : elevation.card,
            style,
            circleStyle,
          ]}
        >
          <IconComponent size={Math.round(CIRCLE * 0.45)} color={color} strokeWidth={2.2} />
        </AnimatedPressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // Absolute so the carousel overlays content rather than reserving a strip of it.
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  scroll: { height: ROW_HEIGHT },
  slot: { width: SLOT, alignItems: 'center', justifyContent: 'center' },
  ringBox: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    borderRadius: RING_SIZE / 2,
    borderWidth: RING_WIDTH,
  },
  circle: { alignItems: 'center', justifyContent: 'center' },
})
