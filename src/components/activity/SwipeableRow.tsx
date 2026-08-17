import { useRef } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable'
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import { useTheme } from '@/src/theme/ThemeProvider'

const ACTION_WIDTH = 84
const MIN_RADIUS = 14
const MAX_RADIUS = 30

function Action({
  icon,
  color,
  progress,
  onPress,
}: {
  icon: string
  color: string
  progress: SharedValue<number>
  onPress: () => void
}) {
  const boxStyle = useAnimatedStyle(() => ({
    borderRadius: interpolate(progress.value, [0, 1], [MIN_RADIUS, MAX_RADIUS], Extrapolation.CLAMP),
  }))
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP) }],
  }))
  return (
    <Animated.View style={[styles.action, { backgroundColor: color }, boxStyle]}>
      <Pressable style={styles.actionPress} onPress={onPress}>
        <Animated.Text style={[styles.actionIcon, iconStyle]}>{icon}</Animated.Text>
      </Pressable>
    </Animated.View>
  )
}

export function SwipeableRow({
  children,
  onDelete,
  onEdit,
  onOpen,
}: {
  children: React.ReactNode
  onDelete: () => void
  onEdit: () => void
  onOpen?: (close: () => void) => void
}) {
  const { tokens } = useTheme()
  const ref = useRef<SwipeableMethods>(null)

  return (
    <Swipeable
      ref={ref}
      friction={2}
      leftThreshold={ACTION_WIDTH / 2}
      rightThreshold={ACTION_WIDTH / 2}
      onSwipeableWillOpen={() => onOpen?.(() => ref.current?.close())}
      renderLeftActions={(progress, _translation, swipeable: SwipeableMethods) => (
        <Action
          icon="✏️"
          color={tokens.gold}
          progress={progress}
          onPress={() => {
            swipeable.close()
            onEdit()
          }}
        />
      )}
      renderRightActions={(progress, _translation, swipeable: SwipeableMethods) => (
        <Action
          icon="🗑️"
          color={tokens.coral}
          progress={progress}
          onPress={() => {
            swipeable.close()
            onDelete()
          }}
        />
      )}
    >
      {children}
    </Swipeable>
  )
}

const styles = StyleSheet.create({
  action: { width: ACTION_WIDTH, margin: 4, overflow: 'hidden' },
  actionPress: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actionIcon: { fontSize: 15 },
})
