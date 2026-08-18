import { useEffect } from 'react'
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { fontFamily } from '@/src/theme/fonts'

export interface BlobSpec {
  size: number
  top?: number
  left?: number
  right?: number
  bottom?: number
  color: string
  borderRadius?: number
  motion: 'drift' | 'drift2' | 'spin'
  durationMs?: number
}

/** One floating decorative circle/blob — mirrors the HTML prototype's wDrift/wDrift2/wSpin keyframes. */
function Blob({ spec }: { spec: BlobSpec }) {
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: spec.durationMs ?? 12000, easing: Easing.linear }),
      -1,
      false,
    )
  }, [])

  const style = useAnimatedStyle(() => {
    if (spec.motion === 'spin') {
      return { transform: [{ rotate: `${progress.value * 360}deg` }] }
    }
    const swing = spec.motion === 'drift' ? { x: 26, y: -34, scale: 1.14 } : { x: -30, y: 26, scale: 0.88 }
    const t = Math.sin(progress.value * Math.PI)
    return {
      transform: [
        { translateX: swing.x * t },
        { translateY: swing.y * t },
        { scale: 1 + (swing.scale - 1) * t },
      ],
    }
  })

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.blob,
        style,
        {
          width: spec.size,
          height: spec.size,
          borderRadius: spec.borderRadius ?? spec.size / 2,
          backgroundColor: spec.color,
          top: spec.top,
          left: spec.left,
          right: spec.right,
          bottom: spec.bottom,
        },
      ]}
    />
  )
}

/** Full-bleed story-card shell: accent background (solid or gradient), floating blobs, big number, supporting copy. */
export function WrappedCard({
  color,
  onColor,
  gradientColors,
  blobs,
  eyebrow,
  children,
  style,
}: {
  color: string
  onColor: string
  gradientColors?: [string, string, string]
  blobs?: BlobSpec[]
  eyebrow?: string
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[styles.card, { backgroundColor: color }, style]}>
      {gradientColors && (
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {blobs?.map((b, i) => <Blob key={i} spec={b} />)}
      {eyebrow && (
        <Text style={[styles.eyebrow, { color: onColor, fontFamily: fontFamily.bodyBold }]}>{eyebrow}</Text>
      )}
      <View style={styles.body}>{children}</View>
    </View>
  )
}

export function WrappedBigNumber({ value, onColor }: { value: string; onColor: string }) {
  return (
    <Text style={[styles.bigNumber, { color: onColor, fontFamily: fontFamily.displayBold }]} numberOfLines={2} adjustsFontSizeToFit>
      {value}
    </Text>
  )
}

export function WrappedCaption({ value, onColor }: { value: string; onColor: string }) {
  return (
    <Text style={[styles.caption, { color: onColor, fontFamily: fontFamily.bodySemiBold }]}>{value}</Text>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 24,
    padding: 28,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  blob: { position: 'absolute' },
  eyebrow: {
    position: 'absolute',
    top: 28,
    left: 28,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.85,
  },
  body: {
    gap: 14,
  },
  bigNumber: {
    fontSize: 46,
    lineHeight: 52,
  },
  caption: {
    fontSize: 17,
    lineHeight: 24,
    opacity: 0.92,
  },
})
