import { StyleSheet, useWindowDimensions } from 'react-native'
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated'
import HomeScreen from '@/app/(tabs)/index'
import ActivityScreen from '@/app/(tabs)/activity'
import EnvelopesScreen from '@/app/(tabs)/envelopes'
import MoreScreen from '@/app/(tabs)/more'
import { useTabSwipe, usePreviewRoute, OverlayPreviewBoundary } from './TabSwipeContext'
import type { NavRoute } from './FloatingNav'

const SCREENS: Record<NavRoute, React.ComponentType> = {
  index: HomeScreen,
  activity: ActivityScreen,
  envelopes: EnvelopesScreen,
  more: MoreScreen,
}

/**
 * Root-level sibling (mounted next to TabBar, see app/_layout.tsx) that renders
 * a fresh, ephemeral copy of whichever tab AnimatedTabContent is currently
 * dragging toward, sliding it in with the shared translateX from
 * TabSwipeContext. The real <Tabs> navigator underneath is untouched — this is
 * purely a visual: pointerEvents="none" so the drag gesture on the real screen
 * keeps sole ownership of the touch stream, and the whole tree unmounts the
 * instant no drag is previewing a neighbour (previewRoute back to null).
 */
export function TabSwipeOverlay() {
  const { translateX } = useTabSwipe()
  const previewRoute = usePreviewRoute()
  const { width: screenWidth } = useWindowDimensions()

  const style = useAnimatedStyle(() => {
    const x = translateX.value
    // Starts fully off whichever edge the drag is heading toward, sliding to 0
    // as the finger closes the remaining distance.
    const edge = x <= 0 ? screenWidth : -screenWidth
    return { transform: [{ translateX: edge + x }] }
  })

  if (!previewRoute) return null
  const Screen = SCREENS[previewRoute]

  return (
    <Reanimated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <OverlayPreviewBoundary>
        <Screen />
      </OverlayPreviewBoundary>
    </Reanimated.View>
  )
}
