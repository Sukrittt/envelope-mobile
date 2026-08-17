import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as SplashScreen from 'expo-splash-screen'
import { setAudioModeAsync } from 'expo-audio'
import { useAppFonts } from '@/src/theme/fonts'
import { ThemeProvider, useTheme } from '@/src/theme/ThemeProvider'
import { accessMode, initAccessMode, type AccessMode } from '@/src/api/accessMode'
import { PrivacyProvider } from '@/src/context/PrivacyContext'
import { AppSplash } from '@/src/components/shared/AppSplash'
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
  const [hasSession, setHasSession] = useState(false)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    initAccessMode().then((restored) => {
      setHasSession(restored !== null)
      setAuthReady(true)
    })
    // unlock.tsx persists a session (real or guest) then navigates straight to
    // (tabs) — without this, hasSession stayed stale until the next app boot
    // and the segments effect below bounced the user right back to /unlock.
    const unsubscribe = accessMode.subscribe((m) => {
      setHasSession(true)
      // Fire-and-forget: registration failures must never block app usage.
      if (m === 'real') registerForPushNotificationsAsync()
    })
    const unsubscribeLogout = accessMode.subscribeLogout(() => {
      setHasSession(false)
      router.replace('/unlock')
    })
    return () => {
      unsubscribe()
      unsubscribeLogout()
    }
  }, [])

  useEffect(() => {
    if (!authReady) return
    const onUnlock = segments[0] === 'unlock'
    if (hasSession && onUnlock) {
      router.replace('/(tabs)')
    } else if (!hasSession && !onUnlock) {
      router.replace('/unlock')
    }
  }, [authReady, hasSession, segments])

  useEffect(() => {
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.query.state.status === 'error' && isAuthError(event.query.state.error)) {
        router.replace('/unlock')
      }
    })
  }, [router])

  if (!authReady) {
    return <AppSplash />
  }

  return <>{children}</>
}

function RootNavigator() {
  const { tokens } = useTheme()
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.bg } }}>
      <Stack.Screen name="unlock" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="investments" options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen
        name="modals/log-expense"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.75],
          sheetCornerRadius: 24,
          sheetGrabberVisible: true,
        }}
      />
      <Stack.Screen name="modals/move-money" options={{ presentation: 'modal' }} />
      <Stack.Screen name="modals/category-manager" options={{ presentation: 'modal' }} />
      <Stack.Screen name="modals/holding-action" options={{ presentation: 'modal' }} />
      <Stack.Screen name="modals/add-holding" options={{ presentation: 'modal' }} />
      <Stack.Screen name="modals/subscription" options={{ presentation: 'modal' }} />
      <Stack.Screen name="modals/money-brain" options={{ presentation: 'card', animation: 'slide_from_right' }} />
    </Stack>
  )
}

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
