import { Pressable } from 'react-native'
import Animated, { useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated'

export function StepDot({
  active,
  activeColor,
  inactiveColor,
  onPress,
}: {
  active: boolean
  activeColor: string
  inactiveColor: string
  onPress: () => void
}) {
  const style = useAnimatedStyle(() => ({
    width: withTiming(active ? 22 : 7, { duration: 250, easing: Easing.ease }),
    backgroundColor: withTiming(active ? activeColor : inactiveColor, { duration: 250, easing: Easing.ease }),
  }))

  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Animated.View style={[{ height: 7, borderRadius: 100 }, style]} />
    </Pressable>
  )
}
