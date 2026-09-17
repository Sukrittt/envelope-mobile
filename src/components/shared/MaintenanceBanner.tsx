import { useEffect, useState } from 'react'
import { AppState, Pressable, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/src/api/client'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'

interface SystemStatus {
  aiDisabled: boolean
  maintenance: { on: boolean; message: string }
}

async function fetchSystemStatus(): Promise<SystemStatus | null> {
  const resp = await apiFetch('/api/system/status')
  return resp.ok ? resp.json() : null
}

/**
 * The maintenance notice set from the web admin's System page. Polled every
 * 5 minutes and on every return to the foreground; tapping hides the current message until a different one is set.
 * Any failure renders nothing.
 */
export function MaintenanceBanner() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const [dismissed, setDismissed] = useState<string | null>(null)
  const { data, refetch } = useQuery({ queryKey: ['system-status'], queryFn: fetchSystemStatus, refetchInterval: 5 * 60_000, retry: false })

  // React Query's refetch-on-focus is web-only; the app's equivalent is coming back to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refetch()
    })
    return () => sub.remove()
  }, [refetch])

  const message = data?.maintenance?.on ? data.maintenance.message : ''
  if (!message || message === dismissed) return null

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${message}. Tap to dismiss.`}
      onPress={() => setDismissed(message)}
      style={[styles.banner, { paddingTop: insets.top + 8, backgroundColor: tokens.cardSolid, borderColor: tokens.warn }]}
    >
      <Text style={[styles.text, { color: tokens.warnInk, fontFamily: fontFamily.bodySemiBold }]}>{message}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, zIndex: 1000 },
  text: { fontSize: 13, textAlign: 'center' },
})
