// A real route, not a conditional branch in the root layout: the root layout
// must render a navigator on its first render, so "still resolving auth" has
// to be a screen inside the Stack rather than something rendered instead of it.
// Deliberately blank (the Stack gives it the orange background): the bird
// animation is an overlay in app/_layout.tsx that outlives this route, so the
// hand-off to the landing screen never shows an unpainted frame.
export default function Loading() {
  return null
}
