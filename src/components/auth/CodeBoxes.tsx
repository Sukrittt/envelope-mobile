import { useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'

type Outcome = 'idle' | 'ok' | 'bad'

// Mirrors web's @keyframes boxErrDrop (translateY -4->2->0, scale 1.04->.97->1,
// .3s ease-out, staggered i*30ms) and @keyframes boxLockIn (scale 1->1.16->1,
// .38s cubic-bezier(.34,1.56,.64,1), staggered i*55ms).
function OutcomeBox({ index, outcome, children }: { index: number; outcome: Outcome; children: React.ReactNode }) {
  const translateY = useSharedValue(0)
  const scale = useSharedValue(1)

  useEffect(() => {
    if (outcome === 'bad') {
      translateY.value = withDelay(
        index * 30,
        withSequence(
          withTiming(-4, { duration: 90, easing: Easing.out(Easing.ease) }),
          withTiming(2, { duration: 90, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 120, easing: Easing.out(Easing.ease) }),
        ),
      )
      scale.value = withDelay(
        index * 30,
        withSequence(
          withTiming(1.04, { duration: 90, easing: Easing.out(Easing.ease) }),
          withTiming(0.97, { duration: 90, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 120, easing: Easing.out(Easing.ease) }),
        ),
      )
    } else if (outcome === 'ok') {
      const bounce = Easing.bezier(0.34, 1.56, 0.64, 1)
      scale.value = withDelay(
        index * 55,
        withSequence(withTiming(1.16, { duration: 152, easing: bounce }), withTiming(1, { duration: 228, easing: bounce })),
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome])

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }, { scale: scale.value }] }))

  return <Animated.View style={[styles.box, style]}>{children}</Animated.View>
}

// Mirrors web's @keyframes greenWash: a radial mint burst behind the boxes on
// success. opacity 0 -> 1 (at 45%) -> 0, scale .2 -> 2.6, .85s cubic-bezier(.16,1,.3,1).
function GreenWash() {
  const scale = useSharedValue(0.2)
  const opacity = useSharedValue(0)

  useEffect(() => {
    const easing = Easing.bezier(0.16, 1, 0.3, 1)
    opacity.value = withSequence(
      withTiming(1, { duration: 383, easing }),
      withTiming(0, { duration: 467, easing }),
    )
    scale.value = withTiming(2.6, { duration: 850, easing })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }))
  const { tokens } = useTheme()

  return <Animated.View pointerEvents="none" style={[styles.wash, { backgroundColor: tokens.mintSoft }, style]} />
}

export function CodeBoxes({ code, length = 6, bad = false, ok = false }: { code: string; length?: number; bad?: boolean; ok?: boolean }) {
  const { tokens } = useTheme()
  const outcome: Outcome = ok ? 'ok' : bad ? 'bad' : 'idle'
  return (
    <View style={styles.row}>
      {Array.from({ length }, (_, i) => {
        const char = code[i] || ''
        const active = i === code.length && outcome === 'idle'
        const borderColor = ok ? tokens.mint : bad ? tokens.coral : active ? tokens.accent : char ? tokens.borderStrong : tokens.border
        const fillColor = ok ? tokens.mint : bad ? tokens.coral : tokens.text
        return (
          <OutcomeBox key={i} index={i} outcome={outcome}>
            <View
              style={[
                styles.fill,
                { backgroundColor: ok ? tokens.mintSoft : bad ? tokens.coralSoft : tokens.inputBg, borderColor },
              ]}
            >
              <Text style={[styles.char, { color: fillColor, fontFamily: fontFamily.displaySemiBold }]}>{char}</Text>
            </View>
          </OutcomeBox>
        )
      })}
      {ok && <GreenWash />}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, position: 'relative' },
  box: { flex: 1, aspectRatio: 1 / 1.2, borderRadius: 16 },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1.5 },
  char: { fontSize: 24 },
  wash: { position: 'absolute', left: '50%', top: '50%', width: 120, height: 120, marginLeft: -60, marginTop: -60, borderRadius: 60 },
})
