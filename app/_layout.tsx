import { useEffect, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { Stack, useRouter, useSegments, useGlobalSearchParams } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as SplashScreen from 'expo-splash-screen'
import { setAudioModeAsync } from 'expo-audio'
import { useAppFonts } from '@/src/theme/fonts'
import { ThemeProvider, useTheme } from '@/src/theme/ThemeProvider'
import { accessMode, initAccessMode, type AccessMode } from '@/src/api/accessMode'
import { getUser } from '@/src/api/account'
import { onOnboarded } from '@/src/api/onboardingSignal'
import { PrivacyProvider } from '@/src/context/PrivacyContext'
import { AppSplash } from '@/src/components/shared/AppSplash'
import { TabBar } from '@/src/components/nav/TabBar'
import {
  configureNotificationHandler,
  registerForPushNotificationsAsync,
  addPushTokenListener,
  addNotificationResponseListener,
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

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const segments = useSegments()
  const { mode: authScreenMode } = useGlobalSearchParams<{ mode?: string }>()
  const [hasSession, setHasSession] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  // null = not yet known (still loading, or signed out) — the redirect effect
  // waits rather than guessing, so a slow /api/user fetch can't bounce the
  // user into onboarding by mistake.
  const [onboarded, setOnboarded] = useState<boolean | null>(null)

  useEffect(() => {
    initAccessMode().then((restored) => {
      setHasSession(restored !== null)
      setAuthReady(true)
    })
    // The auth screens persist a session (real or guest) then navigate
    // straight to (tabs) — without this, hasSession stayed stale until the
    // next app boot and the segments effect below bounced the user right
    // back to the sign-in screen.
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
      router.replace('/(auth)/welcome')
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

  useEffect(() => {
    if (!authReady) return
    const inAuth = segments[0] === '(auth)'
    const inSetup = segments[0] === 'setup'

    if (!hasSession) {
      if (!inAuth) router.replace('/(auth)/welcome')
      return
    }
    // Signed in but onboarded status hasn't resolved yet — wait for it
    // rather than momentarily flashing the wrong screen.
    if (onboarded === null) return

    if (!onboarded) {
      if (!inSetup) router.replace('/setup')
      // A signed-in, onboarded user can legitimately be in (auth)/email or
      // (auth)/code to change their email from Account & security — don't
      // bounce them back to the tabs mid-flow.
    } else if ((inAuth && authScreenMode !== 'change-email') || inSetup) {
      router.replace('/(tabs)')
    }
  }, [authReady, hasSession, onboarded, segments, authScreenMode])

  useEffect(() => onOnboarded(() => setOnboarded(true)), [])

  useEffect(() => {
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.query.state.status === 'error' && isAuthError(event.query.state.error)) {
        router.replace('/(auth)/welcome')
      }
    })
  }, [router])

  if (!authReady) {
    return <AppSplash />
  }

  return <>{children}</>
}

/**
 * The nav is a sibling overlay above the whole root Stack, not scoped to
 * (tabs) or rendered per-screen: it must survive every push (log-expense
 * included) so its carousel can animate between active states instead of
 * unmounting/remounting and cutting. An absolutely-positioned child of the
 * navigator's tabBar slot (which has no height) is untouchable on Android,
 * hence a plain sibling rather than that slot.
 */
function RootNavigator() {
  const { tokens } = useTheme()
  return (
    <View style={styles.root}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.bg } }}>
        <Stack.Screen name="(auth)/welcome" options={{ presentation: 'card', animation: 'slide_from_right' }} />
        <Stack.Screen name="(auth)/email" options={{ presentation: 'card', animation: 'slide_from_right' }} />
        <Stack.Screen name="(auth)/code" options={{ presentation: 'card', animation: 'slide_from_right' }} />
        <Stack.Screen name="setup" options={{ presentation: 'card', animation: 'slide_from_right' }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="investments" options={{ presentation: 'card', animation: 'slide_from_right' }} />
        <Stack.Screen name="account/security" options={{ presentation: 'card', animation: 'slide_from_right' }} />
        <Stack.Screen name="account/data" options={{ presentation: 'card', animation: 'slide_from_right' }} />
        <Stack.Screen name="account/help" options={{ presentation: 'card', animation: 'slide_from_right' }} />
        <Stack.Screen name="insights" options={{ presentation: 'card', animation: 'slide_from_right' }} />
        <Stack.Screen name="wrapped" options={{ presentation: 'fullScreenModal', headerShown: false }} />
        {/* card (not fullScreenModal): a real native modal presentation covers
            the whole window on iOS, hiding the persistent nav below it. */}
        <Stack.Screen name="modals/log-expense" options={{ presentation: 'card', animation: 'fade' }} />
        <Stack.Screen name="modals/expense-added" options={{ presentation: 'card', animation: 'fade' }} />
        <Stack.Screen name="modals/move-money" options={{ presentation: 'modal' }} />
        <Stack.Screen name="modals/holding-action" options={{ presentation: 'modal' }} />
        <Stack.Screen name="modals/add-holding" options={{ presentation: 'modal' }} />
        <Stack.Screen name="modals/subscription" options={{ presentation: 'modal' }} />
        <Stack.Screen name="modals/money-brain" options={{ presentation: 'card', animation: 'slide_from_right' }} />
      </Stack>
      <TabBar />
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

  if (!fontsLoaded) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <PrivacyProvider>
              <AuthGate>
                <RootNavigator />
              </AuthGate>
            </PrivacyProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
