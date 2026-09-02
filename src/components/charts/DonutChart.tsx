import { View, Text, StyleSheet } from 'react-native'
import Svg, { Path, Circle, G } from 'react-native-svg'
import Animated, { FadeIn } from 'react-native-reanimated'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'

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
  children?: React.ReactNode
}

const DEFAULT_SIZE = 200
const DEFAULT_THICKNESS = 28

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

/** Interactive donut: tap a slice (or a legend row driving the same `selectedKey`)
 *  to highlight it. Hand-rolled on react-native-svg, matching TrendChart/AllocationBar. */
export function DonutChart({
  segments,
  selectedKey,
  onSelect,
  size = DEFAULT_SIZE,
  thickness = DEFAULT_THICKNESS,
  children,
}: Props) {
  const { tokens } = useTheme()
  const total = segments.reduce((s, seg) => s + seg.value, 0)

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
  const r = (size - thickness) / 2

  // A single 100% segment is a full 360deg arc, which the M/A path syntax
  // can't express as one arc (start === end). Draw a plain ring instead.
  const singleSegment = segments.length === 1 ? segments[0] : null

  let cursor = 0
  const arcs = singleSegment
    ? []
    : segments.map((seg) => {
        const sweep = (seg.value / total) * 360
        const startDeg = cursor
        const endDeg = cursor + sweep
        cursor = endDeg
        return { seg, startDeg, endDeg }
      })

  function toggle(key: string) {
    onSelect(selectedKey === key ? null : key)
  }

  return (
    <Animated.View entering={FadeIn.duration(400)} style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G>
          {singleSegment ? (
            <Circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={singleSegment.color}
              strokeWidth={thickness}
              onPress={() => toggle(singleSegment.key)}
            />
          ) : (
            arcs.map(({ seg, startDeg, endDeg }) => {
              const isSelected = selectedKey === seg.key
              const dimmed = selectedKey != null && !isSelected
              return (
                <Path
                  key={seg.key}
                  d={arcPath(cx, cy, r, startDeg, Math.min(endDeg, startDeg + 359.999))}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={isSelected ? thickness + 4 : thickness}
                  strokeOpacity={dimmed ? 0.35 : 1}
                  strokeLinecap="butt"
                  onPress={() => toggle(seg.key)}
                />
              )
            })
          )}
        </G>
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="box-none">
        {children}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
})
