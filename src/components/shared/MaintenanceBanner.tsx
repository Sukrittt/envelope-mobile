import { useEffect, useState } from 'react'
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native'
import { TriangleAlert, X } from 'lucide-react-native'
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
 * 5 minutes and on every return to the foreground. A floating pill under the status bar, matching
 * the web banner; the close button hides the current message until a different one is set.
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
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 8 }]}>
      <View accessibilityRole="alert" style={[styles.pill, { backgroundColor: tokens.cardSolid, borderColor: tokens.warn }]}>
        <TriangleAlert size={16} color={tokens.warn} />
        <Text style={[styles.text, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>{message}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          hitSlop={8}
          onPress={() => setDismissed(message)}
          style={[styles.close, { backgroundColor: tokens.warnSoft }]}
        >
          <X size={14} color={tokens.text} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 1000 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingLeft: 14,
    paddingRight: 8,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  text: { flexShrink: 1, fontSize: 13 },
  close: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
})
