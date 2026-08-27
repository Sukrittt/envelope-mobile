import { AppSplash } from '@/src/components/shared/AppSplash'

// A real route, not a conditional branch in the root layout: the root layout
// must render a navigator on its first render, so "still resolving auth" has
// to be a screen inside the Stack rather than something rendered instead of it.
export default function Loading() {
  return <AppSplash />
}
