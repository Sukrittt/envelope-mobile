import { useEffect, useRef } from 'react'
import { Animated, Easing } from 'react-native'

export const FILL_DELAY = 500
export const FILL_DURATION = 900

/** A measured-width tween, shared by envelope risk bars and bill-share bars. */
export function useProgressWidth(trackWidth: number, to: number, from?: number) {
  const width = useRef(new Animated.Value(0)).current
  const revealed = useRef(false)
  useEffect(() => {
    if (trackWidth === 0) return
    const first = !revealed.current
    revealed.current = true
    if (from != null) width.setValue(from / 100 * trackWidth)
    const animation = Animated.timing(width, {
      toValue: to / 100 * trackWidth,
      duration: FILL_DURATION,
      delay: from != null || first ? FILL_DELAY : 0,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    })
    animation.start()
    return () => animation.stop()
  }, [width, trackWidth, to, from])
  return width
}
