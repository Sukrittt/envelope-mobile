// Product analytics. One PostHog client for the whole app, mirroring how
// accessMode and client.ts hold their state: a module singleton, so code
// outside the React tree (the accessMode subscribers below) can reach it.
//
// No PostHogProvider. Lifecycle capture (Application Installed/Opened/
// Backgrounded) is wired in the client constructor, not the provider, and the
// provider's other job, screen autocapture, does not work with the
// react-navigation v7 that expo-router 57 ships. Screens are captured manually
// from usePathname() in app/_layout.tsx instead.
//
// Nothing here sends PII. identify() carries the WorkOS user id and nothing
// else: no email, no name, and never an amount or a merchant string.
import PostHog from 'posthog-react-native'
import { accessMode, currentUserId } from '../api/accessMode'

// Same fail-loud guard as src/api/client.ts: a silently-defaulted key would
// look like working analytics while sending every event nowhere.
if (__DEV__ && !process.env.EXPO_PUBLIC_POSTHOG_KEY) {
  throw new Error('EXPO_PUBLIC_POSTHOG_KEY is not set. Set it in Mobile/.env for local development.')
}

// An empty key disables the client (it logs and drops events) rather than
// throwing, so a release build missing the key degrades instead of crashing.
export const posthog = new PostHog(process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '', {
  host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
})

/**
 * Bind analytics identity to the session. Call once at module scope in the
 * root layout, next to the other app-wide side effects.
 *
 * accessMode is the single choke point every sign-in path passes through
 * (password, magic link, Google, plus restore-on-boot), so this is the one
 * place identity has to be mirrored. Instrumenting each sign-in call site
 * would be four paths that drift apart.
 */
export function initAnalytics(): void {
  accessMode.subscribe((mode) => {
    // Guest sessions stay anonymous. The guard is also load-bearing on the way
    // out: clearAccess() notifies subscribers with 'guest' before the logout
    // subscribers run, and currentUserId() is already null by then.
    if (mode !== 'real') return
    const userId = currentUserId()
    if (userId) posthog.identify(userId)
  })

  // Same contract as queryClient.clear() and clearSnapshot() on logout: drop
  // per-user state so the next account on this device starts clean.
  accessMode.subscribeLogout(() => {
    void posthog.reset()
  })
}
