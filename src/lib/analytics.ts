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
// Name and email are attached to the person record (see identifyUser) so the
// dashboard shows a human rather than a WorkOS id. That is the only personal
// data that leaves the app. Event properties stay clean: no amounts, no item
// or merchant strings, no route params.
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
 * Every product event the app sends. A union rather than a bare string so a
 * typo becomes a type error instead of a junk event nobody notices for a
 * month. Add a name here first, then call track().
 */
export type AppEvent =
  | 'expense_logged'
  | 'bill_scanned'
  | 'money_moved'
  | 'envelope_created'
  | 'money_brain_query'
  | 'onboarding_completed'

/**
 * Properties are for segmenting, never for identifying. Amounts, item names
 * and merchant strings stay out: they are the sensitive half of this app's
 * data and analytics is the wrong place for them.
 *
 * The screen an event fired from comes along for free. posthog.screen()
 * registers $screen_name for the rest of the session, so every event below is
 * already tagged with where it happened.
 */
export function track(event: AppEvent, properties?: Record<string, string | number | boolean>): void {
  // Telemetry never takes down the thing it is measuring. These calls sit in
  // mutation success handlers and inside the onboarding chain, where a throw
  // would be caught by app-level error handling and misread as the operation
  // itself failing.
  try {
    posthog.capture(event, properties)
  } catch {
    // Losing an event is not worth a broken screen.
  }
}

/**
 * Attach name and email to the person record, so PostHog shows a human
 * instead of a WorkOS id. Called once per sign-in from the root layout's
 * existing profile fetch rather than firing its own request.
 *
 * Person properties, not event properties: they live on the person and are
 * not copied onto every event.
 */
export function identifyUser(profile: { email?: string; name?: string | null }): void {
  // Same reasoning as track(): this is called from inside the root layout's
  // getUser() promise chain, whose .catch decides whether the user is treated
  // as onboarded. A throw here would send someone back through setup.
  try {
    const userId = currentUserId()
    if (!userId) return
    // Only send what we actually have. An absent name is common (the API
    // returns null for an account that never set one) and writing that null
    // onto the person record would show up as a blank name in PostHog rather
    // than no name at all.
    const properties: Record<string, string> = {}
    if (profile.email) properties.email = profile.email
    if (profile.name) properties.name = profile.name
    posthog.identify(userId, properties)
  } catch {
    // The person keeps its WorkOS id, just without a name attached.
  }
}

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
