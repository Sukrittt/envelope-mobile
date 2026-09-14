// A real route, not a conditional branch in the root layout: the root layout
// must render a navigator on its first render, so "still resolving auth" has
// to be a screen inside the Stack rather than something rendered instead of it.
// Renders nothing: the native splash stays up over it until the layout's
// guards resolve (see app/_layout.tsx), so it's never actually seen.
export default function Loading() {
  return null
}
