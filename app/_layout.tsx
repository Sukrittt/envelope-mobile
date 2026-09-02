import { useEffect, useRef, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { Stack, useGlobalSearchParams, useRouter, useSegments } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as SplashScreen from 'expo-splash-screen'
import { setAudioModeAsync } from 'expo-audio'
import { useAppFonts } from '@/src/theme/fonts'
import { ThemeProvider, useTheme } from '@/src/theme/ThemeProvider'
import { accessMode, clearAccess, initAccessMode } from '@/src/api/accessMode'
import { getUser } from '@/src/api/account'
import { onOnboarded } from '@/src/api/onboardingSignal'
import { PrivacyProvider } from '@/src/context/PrivacyContext'
import { AlertHost } from '@/src/components/ui/AlertHost'
import { TabBar } from '@/src/components/nav/TabBar'
import { LOG_EXPENSE_PATH } from '@/src/components/nav/FloatingNav'
import { WidgetSync } from '@/src/widgets/WidgetSync'
import { clearSnapshot } from '@/src/widgets/snapshot'
import {
  configureNotificationHandler,
  registerForPushNotificationsAsync,
  addPushTokenListener,
  addNotificationResponseListener,
  checkColdStartNotification,
} from '@/src/lib/notifications'

SplashScreen.preventAutoHideAsync().catch(() => {})
configureNotificationHandler()
// Default playsInSilentMode is false — success/delete sound effects would be
// silently muted whenever the iOS ring switch is off.
setAudioModeAsync({ playsInSilentMode: true }).catch(() => {})

function isAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : ''
  return /: 401\b/.test(message) || /: 403\b/.test(message)
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
})

// Minimum time the AppSplash (loading) screen stays visible on cold boot.
const MIN_SPLASH_MS = 2000

/**
 * The nav is a sibling overlay above the whole root Stack, not scoped to
 * (tabs) or rendered per-screen: it must survive every push (log-expense
 * included) so its carousel can animate between active states instead of
 * unmounting/remounting and cutting. An absolutely-positioned child of the
 * navigator's tabBar slot (which has no height) is untouchable on Android,
 * hence a plain sibling rather than that slot.
 *
 * Auth routing is declarative (Stack.Protected), not a redirect effect: the
 * root layout has to render a navigator on its very first render, and any
 * imperative router call that lands before that mount is dropped by
 * expo-router and logs "state update on a component that hasn't mounted yet".
 * Guards keep the Stack mounted the whole time and just change which screens
 * exist.
 */
function RootNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { tokens } = useTheme()
  const router = useRouter()
  const segments = useSegments()
  const { mode: authScreenMode } = useGlobalSearchParams<{ mode?: string }>()
  const [hasSession, setHasSession] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  // The AppSplash (loading) screen must be visible for at least MIN_SPLASH_MS,
  // even on a fast cold boot (say the session + user resolve instantly), so it
  // doesn't flash off in a few hundred ms. Holds `ready` false until the window
  // elapses, keeping the /loading route mounted.
  const [splashReady, setSplashReady] = useState(false)
  // null = not yet known (still loading, or signed out) — the guards below
  // hold on /loading rather than guessing, so a slow /api/user fetch can't
  // flash the wrong screen.
  const [onboarded, setOnboarded] = useState<boolean | null>(null)
  // Guards which mount/unmount (tabs)'s screens as tabs are switched — a ref
  // here (not an effect in Home itself) survives Home remounting when the
  // user leaves and returns to the tab, so the redirect fires once per
  // sign-in rather than once per Home mount.
  const loggedExpenseRedirect = useRef(false)

  useEffect(() => {
    initAccessMode().then((restored) => {
      setHasSession(restored !== null)
      setAuthReady(true)
    })
    // The auth screens persist a session (real or guest) then let the guards
    // take over — without this, hasSession stayed stale until the next app
    // boot and the user sat on the sign-in screen.
    const unsubscribe = accessMode.subscribe((m) => {
      setHasSession(true)
      // Every cached query (brief, expenses, budgets, chat sessions...) is
      // keyed without a user id, so switching identity (guest <-> real,
      // or a different account) must drop it all or the new identity sees
      // the previous one's data until staleTime happens to expire.
      queryClient.clear()
      // Fire-and-forget: registration failures must never block app usage.
      if (m === 'real') registerForPushNotificationsAsync()
    })
    const unsubscribeLogout = accessMode.subscribeLogout(() => {
      setHasSession(false)
      queryClient.clear()
      loggedExpenseRedirect.current = false
      // Otherwise the next account signed into on this device inherits the
      // previous one's budget numbers on the home screen (see PrivacyContext
      // for the same reasoning applied to the hide-amounts preference).
      void clearSnapshot()
    })
    return () => {
      unsubscribe()
      unsubscribeLogout()
    }
  }, [])

  // Fetch the onboarding flag once per sign-in. Fails open (treats a fetch
  // error as "onboarded") — a flaky /api/user must never trap the user in
  // an onboarding loop.
  useEffect(() => {
    if (!hasSession) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets stale onboarding state across an account switch, ahead of the async refetch below
      setOnboarded(null)
      return
    }
    let cancelled = false
    getUser()
      .then((u) => {
        if (!cancelled) setOnboarded(!!u.onboardedAt)
      })
      .catch(() => {
        if (!cancelled) setOnboarded(true)
      })
    return () => {
      cancelled = true
    }
  }, [hasSession])

  useEffect(() => onOnboarded(() => setOnboarded(true)), [])

  // Minimum splash duration, independent of auth/font latency. Not cleared by
  // the timeout (the state is just set true once and the layout moves on).
  useEffect(() => {
    const timer = setTimeout(() => setSplashReady(true), MIN_SPLASH_MS)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.query.state.status === 'error' && isAuthError(event.query.state.error)) {
        // Drop the dead token, don't just navigate away from it: a redirect
        // alone left it in SecureStore to fail the same way next boot.
        // clearAccess fires the logout subscribers, which flip hasSession.
        void clearAccess()
      }
    })
  }, [])

  const ready = fontsLoaded && authReady && splashReady
  const resolving = !ready || (hasSession && onboarded === null)

  // The one transition the guards can't make: (auth)/email and (auth)/code stay
  // registered while signed in (see the comment on them below), so signing in
  // from those screens removes nothing and leaves the user sitting on them.
  // Safe as an imperative call now — the Stack is mounted from the first render,
  // and the destination's guard is computed in this same render.
  useEffect(() => {
    if (resolving || !hasSession) return
    if (segments[0] !== '(auth)' || authScreenMode === 'change-email') return
    router.replace(onboarded ? '/(tabs)' : '/setup')
  }, [resolving, hasSession, onboarded, segments, authScreenMode, router])

  // Logging an expense is the app's primary verb: open straight into it on
  // launch. Fires once per sign-in (guarded by the ref, reset on logout
  // above) — not per Home mount, since (tabs) remounts Home whenever the
  // user switches tabs and back.
  useEffect(() => {
    if (resolving || !hasSession || onboarded !== true) return
    if (loggedExpenseRedirect.current) return
    loggedExpenseRedirect.current = true
    router.push(LOG_EXPENSE_PATH)
  }, [resolving, hasSession, onboarded, router])

  // The Activity deep link only exists once the signed-in screens do, so a
  // notification that launched the app from killed has to wait for them.
  useEffect(() => {
    if (resolving || !hasSession || !onboarded) return
    checkColdStartNotification().catch((err) => console.warn('Cold-start notification check failed', err))
  }, [resolving, hasSession, onboarded])

  return (
    <View style={[styles.root, { backgroundColor: tokens.bg }]}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.bg } }}>
        <Stack.Protected guard={resolving}>
          <Stack.Screen name="loading" />
        </Stack.Protected>

        <Stack.Protected guard={!resolving && !hasSession}>
          <Stack.Screen name="(auth)/welcome" options={{ presentation: 'card', animation: 'slide_from_right' }} />
        </Stack.Protected>

        {/* Ungated: these are reached both signed out (from welcome) and signed
            in (the change-email flow from Account & security). A guard can't
            read the `mode` param that distinguishes them — that param only
            exists after the navigation the guard would have to allow first. */}
        <Stack.Screen name="(auth)/email" options={{ presentation: 'card', animation: 'slide_from_right' }} />
        <Stack.Screen name="(auth)/code" options={{ presentation: 'card', animation: 'slide_from_right' }} />

        <Stack.Protected guard={!resolving && hasSession && onboarded === false}>
          <Stack.Screen name="setup" options={{ presentation: 'card', animation: 'slide_from_right' }} />
        </Stack.Protected>

        <Stack.Protected guard={!resolving && hasSession && onboarded === true}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="investments" options={{ presentation: 'card', animation: 'slide_from_right' }} />
          <Stack.Screen name="account/security" options={{ presentation: 'card', animation: 'slide_from_right' }} />
          <Stack.Screen name="account/notifications" options={{ presentation: 'card', animation: 'slide_from_right' }} />
          <Stack.Screen name="account/data" options={{ presentation: 'card', animation: 'slide_from_right' }} />
          <Stack.Screen name="account/archive" options={{ presentation: 'card', animation: 'slide_from_right' }} />
          <Stack.Screen name="account/help" options={{ presentation: 'card', animation: 'slide_from_right' }} />
          <Stack.Screen name="account/guided-tour" options={{ presentation: 'card', animation: 'slide_from_right' }} />
          <Stack.Screen name="insights" options={{ presentation: 'card', animation: 'slide_from_right' }} />
          <Stack.Screen name="wrapped" options={{ presentation: 'fullScreenModal', headerShown: false }} />
          {/* card (not fullScreenModal): a real native modal presentation covers
              the whole window on iOS, hiding the persistent nav below it. */}
          <Stack.Screen name="modals/log-expense" options={{ presentation: 'card', animation: 'fade' }} />
          <Stack.Screen name="modals/expense-added" options={{ presentation: 'card', animation: 'fade' }} />
          <Stack.Screen name="modals/expense-failed" options={{ presentation: 'card', animation: 'fade' }} />
          <Stack.Screen name="modals/scan-bill" options={{ presentation: 'card', animation: 'fade' }} />
          <Stack.Screen name="modals/move-money" options={{ presentation: 'modal' }} />
          <Stack.Screen name="modals/holding-action" options={{ presentation: 'modal' }} />
          <Stack.Screen name="modals/add-holding" options={{ presentation: 'modal' }} />
          <Stack.Screen name="modals/subscription" options={{ presentation: 'modal' }} />
          <Stack.Screen name="modals/money-brain" options={{ presentation: 'card', animation: 'slide_from_right' }} />
          <Stack.Screen name="modals/widget-preview" options={{ presentation: 'card', animation: 'slide_from_right' }} />
        </Stack.Protected>
      </Stack>
      <TabBar />
      <AlertHost />
      {/* Same gate as the (tabs) Stack.Protected block above: fires the same
          budgets/expenses queries those screens already fetch, so it must only
          run once they're reachable — not on every cold boot regardless of
          auth state. */}
      {!resolving && hasSession && onboarded === true ? <WidgetSync /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})

export default function RootLayout() {
  const [fontsLoaded] = useAppFonts()

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {})
  }, [fontsLoaded])

  useEffect(() => {
    const tokenSub = addPushTokenListener()
    const responseSub = addNotificationResponseListener()
    return () => {
      tokenSub?.remove()
      responseSub?.remove()
    }
  }, [])

  // No early `return null` while the fonts load: the native splash is still up
  // (preventAutoHideAsync above, hidden by the effect once fontsLoaded), and a
  // render without a navigator is exactly what breaks expo-router.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <PrivacyProvider>
              <RootNavigator fontsLoaded={fontsLoaded} />
            </PrivacyProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
