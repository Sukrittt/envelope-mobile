import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet } from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import { useAudioPlayer } from 'expo-audio'

// Renders inline in place of a button's label (the button itself keeps its
// own background/shape — this is just the icon). Fades in, and the shackle
// tilts open on its right foot — like 🔓. The shackle is a plain (non-animated)
// SVG layered under a real Animated.View: RN-SVG's own `rotation`/`origin`
// props are JS-side convenience props that don't repaint correctly when fed a
// live Animated.Value, so the rotation lives in RN's transform/transformOrigin
// instead. Used by the Google sign-in flourish (welcome.tsx).
export function UnlockIcon({ color, size = 20 }: { color: string; size?: number }) {
  const opacity = useRef(new Animated.Value(0)).current
  const shackleRotate = useRef(new Animated.Value(0)).current
  const successSound = useAudioPlayer(require('@/assets/sounds/success.mp3'))

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    successSound.seekTo(0)
    successSound.play()
    opacity.setValue(0)
    shackleRotate.setValue(0)
    Animated.timing(opacity, { toValue: 1, duration: 200, easing: Easing.ease, useNativeDriver: true }).start()
    Animated.timing(shackleRotate, {
      toValue: 1,
      duration: 350,
      delay: 150,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start()
  }, [])

  return (
    <Animated.View style={{ width: size, height: size, opacity }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={StyleSheet.absoluteFill}>
        <Rect x={3} y={11} width={18} height={11} rx={2} ry={2} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            // Pivot at the shackle's right foot (17,11) in the 24x24 icon box.
            transformOrigin: ['70.8%', '45.8%', 0],
            transform: [{ rotate: shackleRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '20deg'] }) }],
          },
        ]}
      >
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </Animated.View>
  )
}
