import { useEffect, useRef, useState } from 'react'
import { View, Text, Animated, Easing, StyleSheet, type LayoutChangeEvent } from 'react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { fillColor } from './ProgressBar'

const clamp = (n: number) => Math.max(0, Math.min(100, n))
// A tiny expense against a large budget (₹10 of ₹6,000 = 0.17%) would
// otherwise render as an invisible sliver — same floor the reference uses.
const MIN_DELTA_PCT = 2.4

export const DELTA_DELAY = 1050
export const DELTA_DURATION = 400

/**
 * The budget-card bar on the post-log success screen: the base fill grows to
 * where the envelope stood *before* this expense, then a ghost marker pins
 * that spot and a second, brighter segment snaps in to show just the delta —
 * so the charge just made reads as a distinct event, not a bar that was
 * simply longer than expected.
 *
 * RN core Animated rather than Reanimated, matching ProgressBar: plain tweens,
 * no worklet, stays renderable under Jest.
 */
export function DeltaBar({ from, to, amount }: { from: number; to: number; amount: number }) {
  const { tokens, space, radius, type } = useTheme()
  const [trackWidth, setTrackWidth] = useState(0)
  const fromPct = clamp(from)
  const toPct = clamp(to)
  const deltaPct = Math.max(toPct - fromPct, MIN_DELTA_PCT)

  const base = useRef(new Animated.Value(0)).current
  const marker = useRef(new Animated.Value(0)).current
  const delta = useRef(new Animated.Value(0)).current
  const tag = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (trackWidth === 0) return
    base.setValue(0)
    marker.setValue(0)
    delta.setValue(0)
    tag.setValue(0)
    Animated.timing(base, {
      toValue: 1,
      duration: 600,
      delay: 500,
      easing: Easing.bezier(0.2, 0.85, 0.3, 1),
      useNativeDriver: false,
    }).start()
    Animated.timing(marker, {
      toValue: 1,
      duration: 300,
      delay: DELTA_DELAY,
      easing: Easing.bezier(0.2, 0.9, 0.25, 1),
      useNativeDriver: false,
    }).start()
    Animated.timing(delta, {
      toValue: 1,
      duration: DELTA_DURATION,
      delay: DELTA_DELAY,
      easing: Easing.bezier(0.3, 1.1, 0.4, 1),
      useNativeDriver: false,
    }).start()
    Animated.timing(tag, {
      toValue: 1,
      duration: 340,
      delay: DELTA_DELAY + 300,
      easing: Easing.bezier(0.2, 0.9, 0.25, 1),
      useNativeDriver: false,
    }).start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackWidth, fromPct, toPct])

  const fill = fillColor(toPct, tokens)
  const baseWidth = base.interpolate({ inputRange: [0, 1], outputRange: [0, (fromPct / 100) * trackWidth] })
  const deltaLeft = (fromPct / 100) * trackWidth
  const deltaWidth = delta.interpolate({ inputRange: [0, 1], outputRange: [0, (deltaPct / 100) * trackWidth] })
  const markerScale = marker.interpolate({ inputRange: [0, 1], outputRange: [0, 1] })
  const tagOpacity = tag
  const tagTranslate = tag.interpolate({ inputRange: [0, 1], outputRange: [4, 0] })

  return (
    <View>
      <View
        testID="delta-bar-wrap"
        style={styles.trackWrap}
        onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)}
      >
        <View testID="delta-bar-track" style={[styles.track, { backgroundColor: tokens.borderStrong }]}>
          {/* Muted on purpose: the delta segment below is what should read as
              "new" — an equal-brightness base made the whole bar look like a
              single static fill instead of two beats. */}
          <Animated.View
            testID="delta-bar-base"
            style={[styles.fill, styles.base, { width: baseWidth, backgroundColor: fill }]}
          />
          <Animated.View
            testID="delta-bar-delta"
            style={[styles.fill, { left: deltaLeft, width: deltaWidth, backgroundColor: fill }]}
          />
        </View>
        {/* Outside the track's own overflow:hidden clip — a 20px marker on an
            8px bar needs to bleed above/below it. */}
        <Animated.View
          testID="delta-bar-marker"
          style={[
            styles.marker,
            { left: deltaLeft, backgroundColor: tokens.text, transform: [{ scaleY: markerScale }] },
          ]}
        />
      </View>
      <View style={[styles.tagRow, { marginTop: space.xs }]}>
        <Animated.View
          testID="delta-bar-tag"
          style={[styles.tag, { left: deltaLeft, opacity: tagOpacity, transform: [{ translateX: tagTranslate }] }]}
        >
          <View style={[styles.tagPill, { backgroundColor: fill, borderRadius: radius.full }]}>
            <Text style={{ color: tokens.bg, fontFamily: fontFamily.bodySemiBold, fontSize: type.caption }}>
              {`+₹${Math.round(amount).toLocaleString('en-IN')}`}
            </Text>
          </View>
        </Animated.View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  trackWrap: { height: 8 },
  track: { flex: 1, borderRadius: 100, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 100 },
  base: { opacity: 0.55 },
  marker: { position: 'absolute', top: -6, width: 2, height: 20, borderRadius: 2, opacity: 0.85 },
  tagRow: { height: 22 },
  tag: { position: 'absolute' },
  tagPill: { paddingVertical: 4, paddingHorizontal: 9 },
})
