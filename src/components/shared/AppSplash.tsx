import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg'
import { fontFamily } from '@/src/theme/fonts'

const ICON_SIZE = 112
const ICON_RADIUS = 28
const GLOW_SIZE = 240

function useLoopingPulse(from: number, to: number, duration: number, delay = 0) {
  const value = useRef(new Animated.Value(from)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: to,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: from,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    )
    const timer = setTimeout(() => loop.start(), delay)
    return () => {
      clearTimeout(timer)
      loop.stop()
    }
  }, [])
  return value
}

function LoadingDot({ delay }: { delay: number }) {
  const pulse = useLoopingPulse(0.8, 1.1, 500, delay)
  const opacity = pulse.interpolate({ inputRange: [0.8, 1.1], outputRange: [0.35, 1] })
  return <Animated.View style={[styles.dot, { transform: [{ scale: pulse }], opacity }]} />
}

export function AppSplash() {
  const iconScale = useRef(new Animated.Value(0.7)).current
  const iconRotate = useRef(new Animated.Value(-6)).current
  const wordmarkAnim = useRef(new Animated.Value(0)).current
  const glowOpacity = useLoopingPulse(0.5, 0.9, 1200)

  useEffect(() => {
    Animated.parallel([
      Animated.timing(iconScale, {
        toValue: 1,
        duration: 600,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
      Animated.timing(iconRotate, {
        toValue: 0,
        duration: 600,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(iconScale, {
            toValue: 1.03,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(iconScale, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start()
    })

    Animated.timing(wordmarkAnim, {
      toValue: 1,
      duration: 500,
      delay: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [])

  const iconRotateDeg = iconRotate.interpolate({ inputRange: [-6, 0], outputRange: ['-6deg', '0deg'] })
  const wordmarkOpacity = wordmarkAnim
  const wordmarkTranslateY = wordmarkAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] })

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Animated.View style={[styles.glow, { opacity: glowOpacity }]}>
          <Svg width={GLOW_SIZE} height={GLOW_SIZE}>
            <Defs>
              <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="rgb(76, 85, 188)" stopOpacity={0.35} />
                <Stop offset="100%" stopColor="rgb(76, 85, 188)" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width={GLOW_SIZE} height={GLOW_SIZE} fill="url(#glow)" />
          </Svg>
        </Animated.View>

        <Animated.View style={{ transform: [{ scale: iconScale }, { rotate: iconRotateDeg }] }}>
          <Svg width={ICON_SIZE} height={ICON_SIZE}>
            <Defs>
              <LinearGradient id="icon" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#4c55bc" />
                <Stop offset="100%" stopColor="#3d43a8" />
              </LinearGradient>
            </Defs>
            <Rect width={ICON_SIZE} height={ICON_SIZE} rx={ICON_RADIUS} fill="url(#icon)" />
          </Svg>
          <View style={styles.iconGlyph}>
            <Text style={styles.emoji}>💵</Text>
          </View>
        </Animated.View>
      </View>

      <Animated.View
        style={[
          styles.textBlock,
          { opacity: wordmarkOpacity, transform: [{ translateY: wordmarkTranslateY }] },
        ]}
      >
        <Text style={styles.wordmark}>Mission Control</Text>
        <Text style={styles.tagline}>Envelope budgeting, simplified.</Text>
      </Animated.View>

      <View style={styles.dots}>
        <LoadingDot delay={0} />
        <LoadingDot delay={150} />
        <LoadingDot delay={300} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
  iconWrap: {
    width: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    position: 'absolute',
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 48,
  },
  textBlock: {
    alignItems: 'center',
    gap: 4,
  },
  wordmark: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 24,
    color: '#ffffff',
  },
  tagline: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    color: '#8f8f8f',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4c55bc',
  },
})
