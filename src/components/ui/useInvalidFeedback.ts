import * as Haptics from 'expo-haptics'
import { useCallback, useRef } from 'react'
import { Animated, Easing } from 'react-native'

/** Shared invalid-action feedback: one short horizontal shake plus an error haptic. */
export function useInvalidFeedback() {
  const shake = useRef(new Animated.Value(0)).current

  const triggerInvalidFeedback = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
    shake.setValue(0)
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 45, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 90, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 45, easing: Easing.linear, useNativeDriver: true }),
    ]).start()
  }, [shake])

  return { shake, triggerInvalidFeedback }
}
