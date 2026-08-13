import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useTheme } from '@/src/theme/ThemeProvider'

const AnimatedPath = Animated.createAnimatedComponent(Path)

// Length of the "M5 13l4 4L19 7" checkmark path: sqrt(32) + sqrt(200) ≈ 19.8
const CHECK_PATH_LENGTH = 19.8

type SuccessPillProps = {
  success: boolean
  onDone?: () => void
  style: StyleProp<ViewStyle>
  color?: string
  checkColor?: string
  checkSize?: number
  children: React.ReactNode
}

// Swaps `children` (a normal button) for a pill with a self-drawing checkmark
// when `success` flips true. Same animation as log-expense.tsx's original
// inline implementation: pill pops in (scale+opacity, 300ms) while the check
// draws itself (strokeDashoffset, 350ms, starting 220ms in).
export function SuccessPill({ success, onDone, style, color, checkColor, checkSize = 24, children }: SuccessPillProps) {
  const { tokens } = useTheme()
  const scale = useRef(new Animated.Value(0.6)).current
  const opacity = useRef(new Animated.Value(0)).current
  const checkDashoffset = useRef(new Animated.Value(CHECK_PATH_LENGTH)).current

  useEffect(() => {
    if (!success) return
    scale.setValue(0.6)
    opacity.setValue(0)
    checkDashoffset.setValue(CHECK_PATH_LENGTH)
    Animated.timing(scale, { toValue: 1, duration: 300, easing: Easing.ease, useNativeDriver: true }).start()
    Animated.timing(opacity, { toValue: 1, duration: 300, easing: Easing.ease, useNativeDriver: true }).start()
    Animated.timing(checkDashoffset, {
      toValue: 0,
      duration: 350,
      delay: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start()
    if (onDone) {
      const timer = setTimeout(onDone, 1100)
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success])

  if (!success) return <>{children}</>

  return (
    <Animated.View style={[style, { backgroundColor: color ?? tokens.mint, opacity, transform: [{ scale }], justifyContent: 'center', alignItems: 'center' }]}>
      <Svg width={checkSize} height={checkSize} viewBox="0 0 24 24" fill="none">
        <AnimatedPath
          d="M5 13l4 4L19 7"
          stroke={checkColor ?? tokens.onAccent}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={[CHECK_PATH_LENGTH, CHECK_PATH_LENGTH]}
          strokeDashoffset={checkDashoffset}
        />
      </Svg>
    </Animated.View>
  )
}
