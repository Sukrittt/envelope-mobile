import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as SplashScreen from 'expo-splash-screen'
import { useAppFonts } from '@/src/theme/fonts'
import { ThemeProvider, useTheme } from '@/src/theme/ThemeProvider'
import { accessMode, initAccessMode, type AccessMode } from '@/src/api/accessMode'
import { PrivacyProvider } from '@/src/context/PrivacyContext'
import { AppSplash } from '@/src/components/shared/AppSplash'

SplashScreen.preventAutoHideAsync().catch(() => {})

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
    return accessMode.subscribeLogout(() => {
      setHasSession(false)
      router.replace('/unlock')
    })
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
    </Stack>
  )
}

export default function RootLayout() {
  const [fontsLoaded] = useAppFonts()

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {})
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
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
  )
}
