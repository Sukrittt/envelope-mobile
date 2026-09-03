import { useEffect, useRef } from 'react'
import { Animated, Easing, useWindowDimensions } from 'react-native'
import { useIsFocused, usePathname, useRouter } from 'expo-router'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Reanimated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, runOnJS } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { motion } from '@/src/theme/scale'
import { swipeNeighbours, NAV_HREF, LOG_EXPENSE_PATH, type NavRoute } from './FloatingNav'
import { useTabSwipe, useIsOverlayPreview } from './TabSwipeContext'

/**
 * How far the finger has to travel horizontally before the drag activates at
 * all. Sits well clear of SwipeableRow's 24px activation, so a drag started on
 * a transaction row opens that row's actions instead of dragging the screen.
 */
const SWIPE_X = 60
/** Any vertical intent past this belongs to the list, not to us. */
const SWIPE_Y = 12
/** Release distance ceiling that still counts as "wants Add", not "wants the
 *  real screen past it". Only consulted on the Activity<->Envelopes hop. */
const ADD_BAND_MAX = 140
/** Release distance (fraction of screen width) or fling speed that commits to
 *  the real neighbour once the drag is past the Add band, if any. */
const REVEAL_FRACTION = 1 / 3
const REVEAL_VELOCITY = 800

/**
 * Wraps a tab screen's scrollable body (not its fixed header) so it fades + scales
 * in on focus. Bottom-tab navigation itself is unanimated (screens swap instantly);
 * this is what gives the tab switch its crossfade feel without moving the header.
 *
 * It also owns the horizontal drag between screens: this screen slides out with
 * the finger while TabSwipeOverlay (a root-level sibling, see app/_layout.tsx)
 * slides the neighbour in, using the shared translateX from TabSwipeContext so
 * both track the same live value. Every tab body passes through here, so one
 * gesture covers all four rather than a copy per screen, and the current slot is
 * derived from the pathname (as TabBar does) rather than threaded down as a prop.
 *
 * The same component also renders TabSwipeOverlay's ephemeral preview copy of a
 * neighbour screen (each of the four tab screens wraps its body in this
 * unconditionally) — useIsOverlayPreview tells the two apart, since a preview
 * copy needs neither the gesture (its container is pointerEvents="none", so it
 * would never receive a touch) nor the focus-driven fade (it has no focus
 * transition of its own; it should just be visible, sliding in with the drag).
 */
export function AnimatedTabContent({
  children,
  fade = true,
}: {
  children: React.ReactNode
  /** Off on the log-expense card, which the stack already cross-fades in. */
  fade?: boolean
}) {
  const isOverlayPreview = useIsOverlayPreview()
  const isFocused = useIsFocused()
  const progress = useRef(new Animated.Value(isOverlayPreview || !fade ? 1 : 0)).current
  const router = useRouter()
  const pathname = usePathname()
  const { width: screenWidth } = useWindowDimensions()
  const { translateX, setPreviewRoute } = useTabSwipe()
  // Which direction (if any) the overlay is currently previewing, so a mid-drag
  // reversal can re-target it without spamming setPreviewRoute every frame.
  const previewingDir = useSharedValue<1 | -1 | 0>(0)

  useEffect(() => {
    if (isOverlayPreview || !fade) return
    if (!isFocused) return
    progress.setValue(0)
    Animated.timing(progress, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start()
  }, [isFocused, progress, isOverlayPreview, fade])

  // Adjacency is resolved here, on the JS thread, and the gesture callbacks
  // capture only the resulting plain values. Those callbacks are worklets (the
  // reanimated babel plugin auto-workletises gesture handlers), and a worklet
  // can't call a non-worklet import: swipeNeighbours would arrive as undefined
  // on the UI thread and throw on the first frame of the drag.
  const { next: nextRoute, prev: prevRoute, nextIsAdd, prevIsAdd, fromAdd } = swipeNeighbours(pathname)

  function goRoute(name: NavRoute) {
    // Same landing haptic the nav strip fires when a drag settles on a slot.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    // Leaving the log-expense card replaces it rather than stacking a tab under
    // it, matching what tapping a nav circle from there already does.
    if (fromAdd) router.replace(NAV_HREF[name])
    else router.navigate(NAV_HREF[name])
  }

  function goAdd() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    router.push(LOG_EXPENSE_PATH)
  }

  const swipe = Gesture.Pan()
    .enabled(!isOverlayPreview)
    .activeOffsetX([-SWIPE_X, SWIPE_X])
    .failOffsetY([-SWIPE_Y, SWIPE_Y])
    .onStart(() => {
      previewingDir.value = 0
    })
    .onUpdate((e) => {
      const forward = e.translationX < 0
      const route = forward ? nextRoute : prevRoute
      const isAdd = forward ? nextIsAdd : prevIsAdd
      const dist = Math.abs(e.translationX)
      // Add has no visual stop: on the one hop where it sits between two real
      // screens, hold off revealing the far one until the drag has already
      // gone past what a "short swipe into Add" would release at.
      const revealing = isAdd ? dist > ADD_BAND_MAX : route != null
      // No neighbour at all in this direction (Home's right edge, More's left
      // edge): rubber-band instead of following 1:1, so it doesn't look like a
      // full page-turn that then teleports back on release.
      translateX.value = revealing ? e.translationX : e.translationX / 4

      const dir: 1 | -1 = forward ? 1 : -1
      if (revealing && route && previewingDir.value !== dir) {
        previewingDir.value = dir
        runOnJS(setPreviewRoute)(route)
      } else if (!revealing && previewingDir.value !== 0) {
        previewingDir.value = 0
        runOnJS(setPreviewRoute)(null)
      }
    })
    .onEnd((e) => {
      previewingDir.value = 0
      const forward = e.translationX < 0
      const route = forward ? nextRoute : prevRoute
      const isAdd = forward ? nextIsAdd : prevIsAdd
      const dist = Math.abs(e.translationX)
      const pastReveal = dist >= screenWidth * REVEAL_FRACTION || Math.abs(e.velocityX) >= REVEAL_VELOCITY

      if (isAdd && dist <= ADD_BAND_MAX && !pastReveal) {
        translateX.value = withSpring(0, motion.spring)
        runOnJS(setPreviewRoute)(null)
        runOnJS(goAdd)()
        return
      }

      if (pastReveal && route) {
        translateX.value = withTiming(forward ? -screenWidth : screenWidth, { duration: motion.base }, (finished) => {
          if (finished) {
            translateX.value = 0
            runOnJS(setPreviewRoute)(null)
          }
        })
        runOnJS(goRoute)(route)
        return
      }

      translateX.value = withSpring(0, motion.spring)
      runOnJS(setPreviewRoute)(null)
    })

  // Only the real, focused screen visibly tracks the drag — a preview copy's
  // position is fully owned by TabSwipeOverlay's own container instead.
  const outgoingStyle = useAnimatedStyle(() => {
    if (isOverlayPreview) return {}
    return { transform: [{ translateX: translateX.value }] }
  }, [isOverlayPreview])

  const content = (
    <Reanimated.View style={[{ flex: 1 }, outgoingStyle]}>
      <Animated.View
        needsOffscreenAlphaCompositing
        style={{
          flex: 1,
          opacity: progress,
          transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) }],
        }}
      >
        {children}
      </Animated.View>
    </Reanimated.View>
  )

  if (isOverlayPreview) return content
  return <GestureDetector gesture={swipe}>{content}</GestureDetector>
}
