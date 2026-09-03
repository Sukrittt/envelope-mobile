import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useSharedValue, type SharedValue } from 'react-native-reanimated'
import type { NavRoute } from './FloatingNav'

type TabSwipeContextValue = {
  /** Live horizontal drag offset in px, written every frame by the active screen's
   *  pan gesture. Read by that same screen (to slide itself out) and by
   *  TabSwipeOverlay (to slide the previewed neighbour in). 0 at rest. */
  translateX: SharedValue<number>
  setPreviewRoute: (route: NavRoute | null) => void
}

/** Stable for the life of the app, so subscribing to it never re-renders a screen. */
const TabSwipeCtx = createContext<TabSwipeContextValue | null>(null)

/**
 * Which neighbour tab TabSwipeOverlay should mount and preview, or null when no
 * drag is in progress. Plain React state (not a shared value): mounting a screen
 * component is a reconciliation decision, not a per-frame one.
 *
 * Deliberately a second context, read only by the overlay. Setting it mid-drag
 * would otherwise re-render all four tab bodies, and each of those re-renders
 * pushes a fresh config through its GestureDetector — churn on the handler that
 * is at that moment mid-gesture.
 */
const PreviewRouteCtx = createContext<NavRoute | null>(null)

/**
 * Mounted once near the root (see app/_layout.tsx), above both the real <Stack> of
 * tab screens and the sibling TabSwipeOverlay, so a drag started on whichever tab
 * screen is currently focused and the overlay previewing its neighbour read the
 * exact same live position.
 */
export function TabSwipeProvider({ children }: { children: ReactNode }) {
  const translateX = useSharedValue(0)
  const [previewRoute, setPreviewRoute] = useState<NavRoute | null>(null)
  const value = useMemo(() => ({ translateX, setPreviewRoute }), [translateX])
  return (
    <TabSwipeCtx.Provider value={value}>
      <PreviewRouteCtx.Provider value={previewRoute}>{children}</PreviewRouteCtx.Provider>
    </TabSwipeCtx.Provider>
  )
}

export function usePreviewRoute(): NavRoute | null {
  return useContext(PreviewRouteCtx)
}

export function useTabSwipe(): TabSwipeContextValue {
  const ctx = useContext(TabSwipeCtx)
  if (!ctx) throw new Error('useTabSwipe must be used within a TabSwipeProvider')
  return ctx
}

/**
 * True only for the ephemeral copy of a screen TabSwipeOverlay renders while
 * previewing it mid-drag — never for the real, navigator-focused instance. Lets
 * AnimatedTabContent skip the parts of itself that only make sense for the one
 * live screen: the swipe gesture (redundant — the overlay's container is already
 * pointerEvents="none", so it would never receive a touch) and the focus-driven
 * fade-in (the preview has no focus transition of its own; it should just be
 * visible immediately, sliding in as part of the drag rather than fading in on
 * top of it).
 */
const IsOverlayPreviewCtx = createContext(false)

export function OverlayPreviewBoundary({ children }: { children: ReactNode }) {
  return <IsOverlayPreviewCtx.Provider value={true}>{children}</IsOverlayPreviewCtx.Provider>
}

export function useIsOverlayPreview(): boolean {
  return useContext(IsOverlayPreviewCtx)
}
