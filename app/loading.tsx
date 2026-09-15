import { BirdLandingSplash } from '@/src/components/splash/BirdLandingSplash'

// A real route, not a conditional branch in the root layout: the root layout
// must render a navigator on its first render, so "still resolving auth" has
// to be a screen inside the Stack rather than something rendered instead of it.
// The native splash only covers the pre-JS gap (see app/_layout.tsx's
// splash-hide effect) — it hides as soon as fonts are ready, and this bird
// landing animation takes over as the visible screen for whatever's left of
// the auth/onboarding resolve.
export default function Loading() {
  return <BirdLandingSplash />
}
