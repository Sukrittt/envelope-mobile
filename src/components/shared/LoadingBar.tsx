import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import { useTheme } from '@/src/theme/ThemeProvider'

const WIDTH = 120
const SEGMENT = 44

/** Indeterminate loading line — a segment sliding back and forth across a track. */
export function LoadingBar() {
  const { tokens } = useTheme()
  const x = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(x, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(x, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [x])

  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [0, WIDTH - SEGMENT] })

  return (
    <View style={[styles.track, { backgroundColor: tokens.borderStrong }]}>
      <Animated.View style={[styles.fill, { backgroundColor: tokens.gold, transform: [{ translateX }] }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  track: { width: WIDTH, height: 4, borderRadius: 100, overflow: 'hidden' },
  fill: { position: 'absolute', width: SEGMENT, height: '100%', borderRadius: 100 },
})
