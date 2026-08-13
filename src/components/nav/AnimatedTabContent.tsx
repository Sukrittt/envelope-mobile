import { useEffect, useRef } from 'react'
import { Animated, Easing } from 'react-native'
import { useIsFocused } from 'expo-router'

/**
 * Wraps a tab screen's scrollable body (not its fixed header) so it fades + scales
 * in on focus. Bottom-tab navigation itself is unanimated (screens swap instantly);
 * this is what gives the tab switch its crossfade feel without moving the header.
 */
export function AnimatedTabContent({ children }: { children: React.ReactNode }) {
  const isFocused = useIsFocused()
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!isFocused) return
    progress.setValue(0)
    Animated.timing(progress, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start()
  }, [isFocused])

  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: progress,
        transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) }],
      }}
    >
      {children}
    </Animated.View>
  )
}
