import { requireOptionalNativeModule } from 'expo'
import type { ComponentType } from 'react'

// Expo Go and dev builds made before expo-observe was added don't ship the
// ExpoAppMetrics native module, and importing expo-observe there throws at
// startup. Probe first and fall back to no-ops so the app still launches.
type Observe = typeof import('expo-observe')

const observe: Observe | null = requireOptionalNativeModule('ExpoAppMetrics')
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('expo-observe') as Observe)
  : null

export const useObserve = observe?.useObserve ?? (() => ({ markInteractive() {} }))

export const wrapRoot = (Root: ComponentType): ComponentType =>
  observe ? observe.ObserveRoot.wrap(Root) : Root
