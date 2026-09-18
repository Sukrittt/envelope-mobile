import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import { BirdLandingMark } from './BirdLandingMark'
import { fontFamily } from '@/src/theme/fonts'

const ORANGE = '#F04E23'
const CREAM = '#FFF6EE'
const SIZE = 240
const DOT_DELAYS = [1600, 1750, 1900] as const

// The bird lands while fonts/auth/onboarding resolve in the background. The
// route unmounts as soon as resolving finishes, so this adds no fixed delay.
export function BirdLandingSplash() {
  const wordmark = useRef(new Animated.Value(0)).current
  const dots = useRef(DOT_DELAYS.map(() => new Animated.Value(0))).current

  useEffect(() => {
    const wordmarkIn = Animated.timing(wordmark, {
      toValue: 1,
      duration: 600,
      delay: 1250,
      easing: Easing.bezier(0.2, 0.8, 0.25, 1),
      useNativeDriver: true,
    })
    wordmarkIn.start()

    const dotTimers = dots.map((dot, i) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(dot, { toValue: 1, duration: 575, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 575, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      )
      const timer = setTimeout(() => loop.start(), DOT_DELAYS[i])
      return { loop, timer }
    })

    return () => {
      wordmarkIn.stop()
      dotTimers.forEach(({ loop, timer }) => {
        clearTimeout(timer)
        loop.stop()
      })
    }
  }, [dots, wordmark])

  const wordmarkStyle = {
    opacity: wordmark.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
    transform: [{ translateY: wordmark.interpolate({ inputRange: [0, 1], outputRange: [7.5, 0] }) }],
  }

  return (
    <View style={styles.root}>
      <BirdLandingMark size={SIZE} color={CREAM} idle />

      <Animated.Text style={[styles.wordmark, wordmarkStyle]}>Aviary</Animated.Text>

      <View style={styles.dots}>
        {DOT_DELAYS.map((delay, i) => {
          const progress = dots[i]
          const style = {
            opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.28, 1] }),
            transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) }],
          }
          return <Animated.View key={delay} style={[styles.dot, style]} />
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  // Fixed width instead of shrink-to-fit: negative letterSpacing makes the
  // box size depend on the exact glyph metrics used at layout time, and a
  // paddingRight compensation (previous fix) wasn't enough once production's
  // metrics differed from dev's, still clipping the final "y". A width wide
  // enough for "Aviary" at this font/size is immune to that either way.
  wordmark: { fontFamily: fontFamily.displaySemiBold, fontSize: 34, letterSpacing: -0.5, color: CREAM, marginTop: -6, width: 160, textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 9, marginTop: 28 },
  dot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: CREAM },
})
