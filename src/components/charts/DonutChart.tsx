import { useEffect, useRef } from 'react'
import { View, Text, Animated, Easing, StyleSheet } from 'react-native'
import Svg, { Path, Circle, G } from 'react-native-svg'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'

const AnimatedPath = Animated.createAnimatedComponent(Path)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

export interface DonutSegment {
  key: string
  label: string
  emoji: string
  value: number
  color: string
}

interface Props {
  segments: DonutSegment[]
  selectedKey: string | null
  onSelect: (key: string | null) => void
  size?: number
  thickness?: number
  /** Bumped by the caller's useReveal() to (re)play the wipe — on the screen's
   *  first settled paint, and again whenever the segments are swapped out. */
  revealKey?: number
  children?: React.ReactNode
}

const DEFAULT_SIZE = 200
const DEFAULT_THICKNESS = 28

const SWEEP_DELAY = 80
const SWEEP_DURATION = 450
/** How far the selected wedge pushes out of the ring, along its own bisector. */
const LIFT = 6

/** Point on a circle of `r` centered at (cx, cy), at `angleDeg` clockwise from the top. */
function pointOnCircle(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

/** Arc path (stroke only, no fill) from `startDeg` to `endDeg` clockwise from the top. */
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = pointOnCircle(cx, cy, r, startDeg)
  const end = pointOnCircle(cx, cy, r, endDeg)
  const largeArc = endDeg - startDeg > 180 ? 1 : 0
  return `M${start.x.toFixed(2)},${start.y.toFixed(2)} A${r},${r} 0 ${largeArc} 1 ${end.x.toFixed(2)},${end.y.toFixed(2)}`
}

interface SliceProps {
  seg: DonutSegment
  startDeg: number
  endDeg: number
  cx: number
  cy: number
  r: number
  thickness: number
  /** 0..1 clockwise wipe driving every wedge off one timeline. */
  sweep: Animated.Value
  isSelected: boolean
  anySelected: boolean
  onPress: () => void
}

/**
 * One wedge. Its own emphasis value carries three states at once — 0 dimmed,
 * 1 neutral, 2 selected — so the width bump, the fade of its neighbours and
 * the lift out of the ring all spring off a single driver instead of three.
 */
function DonutSlice({ seg, startDeg, endDeg, cx, cy, r, thickness, sweep, isSelected, anySelected, onPress }: SliceProps) {
  const { motion } = useTheme()
  const state = isSelected ? 2 : anySelected ? 0 : 1
  const emphasis = useRef(new Animated.Value(state)).current

  useEffect(() => {
    Animated.spring(emphasis, { toValue: state, useNativeDriver: false, ...motion.spring }).start()
  }, [emphasis, state, motion.spring])

  // Stroke length of this arc, so dasharray/dashoffset can draw it on — the
  // same trick CheckIcon uses for its checkmark, scaled to each wedge's sweep.
  const len = 2 * Math.PI * r * ((endDeg - startDeg) / 360)
  // A zero-value segment has no range to interpolate over; render it drawn.
  const dashoffset =
    endDeg > startDeg
      ? sweep.interpolate({
          inputRange: [startDeg / 360, endDeg / 360],
          outputRange: [len, 0],
          extrapolate: 'clamp',
        })
      : 0

  // Unit vector along the wedge's bisector, so it lifts straight outward.
  const mid = (startDeg + endDeg) / 2
  const dir = pointOnCircle(0, 0, 1, mid)
  // The spring overshoots past its target, so every output range clamps.
  const lift = (axis: number) =>
    emphasis.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 0, axis * LIFT], extrapolate: 'clamp' })

  return (
    <AnimatedPath
      d={arcPath(cx, cy, r, startDeg, Math.min(endDeg, startDeg + 359.999))}
      fill="none"
      stroke={seg.color}
      strokeWidth={emphasis.interpolate({
        inputRange: [0, 1, 2],
        outputRange: [thickness, thickness, thickness + 4],
        extrapolate: 'clamp',
      })}
      strokeOpacity={emphasis.interpolate({
        inputRange: [0, 1, 2],
        outputRange: [0.35, 1, 1],
        extrapolate: 'clamp',
      })}
      strokeDasharray={[len, len]}
      strokeDashoffset={dashoffset}
      translateX={lift(dir.x)}
      translateY={lift(dir.y)}
      strokeLinecap="butt"
      onPress={onPress}
    />
  )
}

/** Interactive donut: tap a slice (or a legend row driving the same `selectedKey`)
 *  to highlight it. Hand-rolled on react-native-svg, matching TrendChart/AllocationBar. */
export function DonutChart({
  segments,
  selectedKey,
  onSelect,
  size = DEFAULT_SIZE,
  thickness = DEFAULT_THICKNESS,
  revealKey,
  children,
}: Props) {
  const { tokens } = useTheme()
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  const hasData = total > 0

  // Hooks must run unconditionally — declared above the `total <= 0` bail-out
  // below (same call as AllocationBar). A caller that drives no reveal gets the
  // ring drawn outright rather than an invisible one waiting for a cue.
  const sweep = useRef(new Animated.Value(revealKey == null ? 1 : 0)).current
  useEffect(() => {
    // Nothing to wipe open yet. Running here anyway is what used to spend the
    // whole sweep on the empty state while the queries were still in flight.
    if (!hasData || !revealKey) return
    sweep.setValue(0)
    // ponytail: a swapped-out dataset re-wipes rather than morphing wedge
    // angles from their old positions. Morphing needs enter/exit handling for
    // segments that only exist in one of the two sets (category vs group);
    // upgrade there if the re-wipe ever reads as too heavy a reset.
    const anim = Animated.timing(sweep, {
      toValue: 1,
      duration: SWEEP_DURATION,
      delay: SWEEP_DELAY,
      // Eased at both ends, same call as ProgressBar's fill: an out-only curve
      // left the wipe at full speed from the first frame.
      easing: Easing.inOut(Easing.cubic),
      // strokeDashoffset is an SVG prop, not native-driver-friendly.
      useNativeDriver: false,
    })
    anim.start()
    return () => anim.stop()
  }, [sweep, hasData, revealKey])

  if (total <= 0) {
    return (
      <View style={[styles.empty, { width: size, height: size }]}>
        <Text style={{ color: tokens.text3, fontFamily: fontFamily.bodyMedium, fontSize: 12 }}>
          No spending data yet
        </Text>
      </View>
    )
  }

  const cx = size / 2
  const cy = size / 2
  // Selected slices draw at thickness+4 and push LIFT px outward; shrink the
  // base radius by both so neither one clips against the SVG canvas edge.
  const r = (size - thickness) / 2 - (LIFT + 2)

  // A single 100% segment is a full 360deg arc, which the M/A path syntax
  // can't express as one arc (start === end). Draw a plain ring instead.
  const singleSegment = segments.length === 1 ? segments[0] : null
  const ringLength = 2 * Math.PI * r

  let cursor = 0
  const arcs = singleSegment
    ? []
    : segments.map((seg) => {
        const sweepDeg = (seg.value / total) * 360
        const startDeg = cursor
        const endDeg = cursor + sweepDeg
        cursor = endDeg
        return { seg, startDeg, endDeg }
      })

  function toggle(key: string) {
    onSelect(selectedKey === key ? null : key)
  }

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G>
          {singleSegment ? (
            <AnimatedCircle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={singleSegment.color}
              strokeWidth={thickness}
              strokeDasharray={[ringLength, ringLength]}
              strokeDashoffset={sweep.interpolate({ inputRange: [0, 1], outputRange: [ringLength, 0] })}
              onPress={() => toggle(singleSegment.key)}
            />
          ) : (
            arcs.map(({ seg, startDeg, endDeg }) => (
              <DonutSlice
                key={seg.key}
                seg={seg}
                startDeg={startDeg}
                endDeg={endDeg}
                cx={cx}
                cy={cy}
                r={r}
                thickness={thickness}
                sweep={sweep}
                isSelected={selectedKey === seg.key}
                anySelected={selectedKey != null}
                onPress={() => toggle(seg.key)}
              />
            ))
          )}
        </G>
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="box-none">
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
})
