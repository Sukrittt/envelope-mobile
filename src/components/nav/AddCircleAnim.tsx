import { useEffect, useRef } from 'react'
import { View, Animated, Easing, StyleSheet } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { CheckIcon } from '@/src/components/shared/CheckIcon'
import { PlusGlyph } from './NavIcons'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

// Both phases render in a box wider than the 56px nav circle underneath —
// NavCircle's Pressable has no overflow:hidden, so this is free to bleed a
// few px past the circle's edge for the ring/halo without any layout change
// there. Sized to the ~17px of vertical room the nav row leaves around the
// circle (see FloatingNav's ROW_HEIGHT/RING_SIZE math) rather than the
// reference's 76px box, which would clip against the row.
const BOX = 64
const RING_WIDTH = 3
const RING_R = (BOX - RING_WIDTH) / 2
const RING_CIRC = 2 * Math.PI * RING_R
const ICON = 22

/**
 * Shown in place of the plus glyph while the add-expense request is in
 * flight: the plus rotates/shrinks away, a ripple pulses out from the disc,
 * and a sweeping ring spins to read as "working" rather than "frozen".
 * Mirrors the reference's load phase (`leSquish`/`lePlusOut`/`leSweep`).
 */
export function AddCircleLoad({ discColor, iconColor }: { discColor: string; iconColor: string }) {
  const ripple = useRef(new Animated.Value(0)).current
  const squish = useRef(new Animated.Value(0)).current
  const plus = useRef(new Animated.Value(0)).current
  const track = useRef(new Animated.Value(0)).current
  const spin = useRef(new Animated.Value(0)).current
  const sweep = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(ripple, {
      toValue: 1,
      duration: 600,
      easing: Easing.bezier(0.2, 0.9, 0.25, 1),
      useNativeDriver: true,
    }).start()
    Animated.timing(squish, {
      toValue: 1,
      duration: 500,
      easing: Easing.bezier(0.3, 1.4, 0.4, 1),
      useNativeDriver: true,
    }).start()
    Animated.timing(plus, {
      toValue: 1,
      duration: 340,
      easing: Easing.bezier(0.5, 0, 0.2, 1),
      useNativeDriver: true,
    }).start()
    Animated.timing(track, {
      toValue: 1,
      duration: 300,
      easing: Easing.bezier(0.2, 0.9, 0.25, 1),
      useNativeDriver: true,
    }).start()
    // Never resolves on its own (it's a spinner) — stopped on unmount below,
    // or it keeps ticking (and re-rendering) past the phase that owns it.
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: true }),
    )
    loop.start()
    // Native driver can't touch strokeDashoffset — same tradeoff CheckIcon makes.
    Animated.timing(sweep, {
      toValue: 1,
      duration: 720,
      easing: Easing.bezier(0.45, 0.05, 0.35, 1),
      useNativeDriver: false,
    }).start()
    return () => loop.stop()
  }, [ripple, squish, plus, track, spin, sweep])

  const rippleStyle = {
    opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
    transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.9, 2.4] }) }],
  }
  const squishStyle = {
    transform: [
      { scale: squish.interpolate({ inputRange: [0, 0.18, 1], outputRange: [1, 0.9, 0.96] }) },
    ],
  }
  const plusStyle = {
    opacity: plus.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: [
      { rotate: plus.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '135deg'] }) },
      { scale: plus.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }) },
    ],
  }
  const trackStyle = {
    opacity: track.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
    transform: [{ scale: track.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
  }
  const spinStyle = {
    transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
  }
  // 214 -> 26 -> 18 in the reference, expressed as fractions of circumference
  // so they carry over to this ring's own (smaller) radius.
  const dashoffset = sweep.interpolate({
    inputRange: [0, 0.92, 1],
    outputRange: [RING_CIRC, RING_CIRC * (26 / 214), RING_CIRC * (18 / 214)],
  })

  return (
    <View style={styles.box} pointerEvents="none">
      <Animated.View style={[styles.disc, { backgroundColor: discColor }, rippleStyle]} />
      <Animated.View style={[styles.disc, { backgroundColor: discColor }, squishStyle]} />
      <Animated.View style={plusStyle}>
        <PlusGlyph size={ICON} color={iconColor} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, trackStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, spinStyle]}>
          <Svg width={BOX} height={BOX} viewBox={`0 0 ${BOX} ${BOX}`}>
            <Circle
              cx={BOX / 2}
              cy={BOX / 2}
              r={RING_R}
              fill="none"
              stroke={iconColor}
              strokeOpacity={0.22}
              strokeWidth={RING_WIDTH}
            />
            <AnimatedCircle
              cx={BOX / 2}
              cy={BOX / 2}
              r={RING_R}
              fill="none"
              stroke={discColor}
              strokeWidth={RING_WIDTH}
              strokeLinecap="round"
              strokeDasharray={RING_CIRC}
              strokeDashoffset={dashoffset}
            />
          </Svg>
        </Animated.View>
      </Animated.View>
    </View>
  )
}

/**
 * Shown once the add succeeds: a halo ring expands and fades, the disc pops
 * in, and the tick draws over it. `disc`/`check` follow the app's existing
 * inline-success convention (`CheckIcon` on a `tokens.mint` fill) rather than
 * the reference's accent-tinted pop, so this reads the same as every other
 * success button in the app.
 */
export function AddCircleDone({ discColor, checkColor }: { discColor: string; checkColor: string }) {
  const halo = useRef(new Animated.Value(0)).current
  const pop = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(halo, {
      toValue: 1,
      duration: 620,
      easing: Easing.bezier(0.2, 0.8, 0.3, 1),
      useNativeDriver: true,
    }).start()
    Animated.timing(pop, {
      toValue: 1,
      duration: 520,
      easing: Easing.bezier(0.3, 1.5, 0.4, 1),
      useNativeDriver: true,
    }).start()
  }, [halo, pop])

  const haloStyle = {
    opacity: halo.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
    transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.4] }) }],
  }
  const popStyle = {
    transform: [
      {
        scale: pop.interpolate({
          inputRange: [0, 0.4, 0.7, 1],
          outputRange: [0.92, 1.14, 0.97, 1],
        }),
      },
    ],
  }

  return (
    <View style={styles.box} pointerEvents="none">
      <Animated.View style={[styles.halo, { borderColor: discColor }, haloStyle]} />
      <Animated.View style={[styles.disc, { backgroundColor: discColor }, popStyle]} />
      <CheckIcon color={checkColor} size={ICON} />
    </View>
  )
}

const styles = StyleSheet.create({
  box: { width: BOX, height: BOX, alignItems: 'center', justifyContent: 'center' },
  disc: { position: 'absolute', width: BOX - 8, height: BOX - 8, borderRadius: (BOX - 8) / 2 },
  halo: { position: 'absolute', width: BOX - 8, height: BOX - 8, borderRadius: (BOX - 8) / 2, borderWidth: 3 },
})
