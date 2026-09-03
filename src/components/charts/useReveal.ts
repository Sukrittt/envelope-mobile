import { useEffect, useRef, useState } from 'react'
import { useIsFocused } from 'expo-router'

/** Roughly the length of the stack's `slide_from_right` push (app/_layout.tsx),
 *  after which the screen is sitting still and an entrance is worth watching.
 *
 *  ponytail: a constant, not the real transition. `transitionEnd` would be
 *  exact but only exists on a native-stack screen, and InteractionManager (the
 *  usual stand-in) is deprecated in RN 0.86 and fires on JS idle, which a
 *  natively-driven slide reaches almost immediately. Swap it for a real signal
 *  if the transition ever becomes configurable per screen. */
const SETTLE_MS = 320

/**
 * When a chart's entrance animation is allowed to run.
 *
 * Mount is the wrong moment for three reasons, each of which cost the Insights
 * breakdown its whole reveal:
 *
 * 1. /insights is pushed with `slide_from_right`. An animation started at mount
 *    plays *behind* that transition and is over by the time the screen has
 *    finished sliding in.
 * 2. The screen renders before its queries resolve, so a mount-only animation is
 *    spent on an empty chart and the real data lands already drawn.
 * 3. Mount happens once, so nothing replays when the data underneath is swapped
 *    out (category vs group, or a different month).
 *
 * Returns 0 until the reveal is armed, then a nonce that bumps on every new
 * `scope`. Callers use it both as the "play now" flag (`> 0`) and inside a child
 * `key`, which remounts the mount-only animators (PopIn, BudgetBar) so they
 * replay without having to be rewritten as reactive.
 */
export function useReveal(scope: string, ready: boolean): number {
  const isFocused = useIsFocused()
  const [settled, setSettled] = useState(false)
  const [nonce, setNonce] = useState(0)
  const lastScope = useRef<string | null>(null)

  useEffect(() => {
    if (!isFocused || settled) return
    const id = setTimeout(() => setSettled(true), SETTLE_MS)
    return () => clearTimeout(id)
  }, [isFocused, settled])

  useEffect(() => {
    if (!settled || !ready) return
    if (lastScope.current === scope) return
    lastScope.current = scope
    setNonce((n) => n + 1)
  }, [settled, ready, scope])

  return nonce
}
