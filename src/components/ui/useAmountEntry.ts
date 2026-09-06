import * as Haptics from 'expo-haptics';
import { useCallback, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

/** Shared numpad editing; screens can reset dependent allocation state after an edit. */
export function useAmountEntry(initial = '', options: { onChange?: () => void; shakeAtZero?: boolean } = {}) {
  const [amount, setAmount] = useState(initial)
  const shake = useRef(new Animated.Value(0)).current
  const { onChange, shakeAtZero = false } = options
  const pushDigit = useCallback((digit: string) => {
    setAmount(prev => {
      if (digit === '.') return prev.includes('.') ? prev : prev === '' ? '0.' : prev + '.'
      const dot = prev.indexOf('.')
      if (dot !== -1 && prev.length - dot - 1 >= 2) return prev
      const next = (prev + digit).replace(/^0+(?=\d)/, '')
      return next.length > 9 ? prev : next
    })
    onChange?.()
  }, [onChange])
  const handleBackspace = useCallback(() => {
    if (shakeAtZero ? Number(amount) === 0 : amount === '') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { })
      shake.setValue(0)
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 45, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 90, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 45, easing: Easing.linear, useNativeDriver: true }),
      ]).start()
      return
    }
    setAmount(prev => prev.slice(0, -1))
    onChange?.()
  }, [amount, onChange, shake, shakeAtZero])
  return { amount, setAmount, pushDigit, handleBackspace, shake }
}
