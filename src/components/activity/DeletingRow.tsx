import { useEffect, useState } from 'react'
import { StyleSheet, Text, type LayoutChangeEvent } from 'react-native'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useTheme } from '@/src/theme/ThemeProvider'

export function DeletingRow({
  active,
  onDone,
  children,
}: {
  active: boolean
  onDone: () => void
  children: React.ReactNode
}) {
  const { tokens } = useTheme()
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null)
  const pillProgress = useSharedValue(0)
  const height = useSharedValue(0)
  const opacity = useSharedValue(1)

  useEffect(() => {
    if (!active || measuredHeight === null) return
    height.value = measuredHeight
    pillProgress.value = withTiming(1, { duration: 180 }, (finished) => {
      if (!finished) return
      height.value = withTiming(0, { duration: 220 })
      opacity.value = withTiming(0, { duration: 220 }, (done) => {
        if (done) runOnJS(onDone)()
      })
    })
  }, [active, measuredHeight])

  const containerStyle = useAnimatedStyle(() => ({
    height: active && measuredHeight !== null ? height.value : undefined,
    opacity: active ? opacity.value : 1,
  }))
  const overlayStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: pillProgress.value }],
    opacity: pillProgress.value,
  }))

  function onLayout(e: LayoutChangeEvent) {
    setMeasuredHeight((h) => h ?? e.nativeEvent.layout.height)
  }

  return (
    <Animated.View style={[styles.container, containerStyle]} onLayout={onLayout}>
      {children}
      {active && (
        <Animated.View pointerEvents="none" style={[styles.overlay, overlayStyle, { backgroundColor: tokens.coral }]}>
          <Text style={styles.icon}>🗑️</Text>
        </Animated.View>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    transformOrigin: 'right',
  },
  icon: { fontSize: 18 },
})
