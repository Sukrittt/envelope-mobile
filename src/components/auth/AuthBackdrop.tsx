import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { useTheme } from '@/src/theme/ThemeProvider'

// The two drifting blurred blobs behind the welcome screen (mirrors web's
// @keyframes drift1, 16s / 22s reverse). RN has no CSS blur filter, so the
// softness comes entirely from the tokens' own translucent gold/mint alpha.
export function AuthBackdrop() {
  const { tokens } = useTheme()
  const t1 = useSharedValue(0)
  const t2 = useSharedValue(0)

  useEffect(() => {
    t1.value = withRepeat(withTiming(1, { duration: 16000, easing: Easing.inOut(Easing.ease) }), -1, true)
    t2.value = withRepeat(withTiming(1, { duration: 22000, easing: Easing.inOut(Easing.ease) }), -1, true)
  }, [t1, t2])

  const style1 = useAnimatedStyle(() => ({
    transform: [
      { translateX: t1.value * 30 },
      { translateY: t1.value * -24 },
      { rotate: `${t1.value * 10}deg` },
    ],
  }))
  const style2 = useAnimatedStyle(() => ({
    transform: [
      { translateX: t2.value * -30 },
      { translateY: t2.value * 24 },
      { rotate: `${t2.value * -10}deg` },
    ],
  }))

  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.blobGold, { backgroundColor: tokens.goldSoft }, style1]} />
      <Animated.View pointerEvents="none" style={[styles.blobMint, { backgroundColor: tokens.mintSoft }, style2]} />
    </>
  )
}

const styles = StyleSheet.create({
  blobGold: { position: 'absolute', top: -120, right: -90, width: 280, height: 280, borderRadius: 140 },
  blobMint: { position: 'absolute', bottom: 120, left: -110, width: 220, height: 220, borderRadius: 110 },
})
