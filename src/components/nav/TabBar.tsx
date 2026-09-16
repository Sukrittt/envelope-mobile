import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

/** Persistent animated nav container; feature actions and hints are supplied by its caller. */
export function TabBar({ visible, overrideContent }: { visible: boolean; overrideContent: ReactNode }) {
  const visibility = useSharedValue(visible ? 1 : 0)
  // First show is instant: it's the launch landing, where the screen under it
  // appears without a transition, so a fade would read as the nav lagging.
  const shown = useRef(visible)
  useEffect(() => {
    visibility.value = shown.current ? withTiming(visible ? 1 : 0, { duration: 160 }) : visible ? 1 : 0
    if (visible) shown.current = true
  }, [visible, visibility])
  const style = useAnimatedStyle(() => ({ opacity: visibility.value }))
  return <Reanimated.View style={[StyleSheet.absoluteFill, style]} pointerEvents={visible ? 'box-none' : 'none'}>{overrideContent}</Reanimated.View>
}
