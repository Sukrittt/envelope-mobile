import { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { WifiOff } from 'lucide-react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { formatRelativeTime } from '@/src/lib/format'
import { Button } from '@/src/components/ui/Button'
import { LOG_EXPENSE_PATH } from '@/src/components/nav/FloatingNav'
import { count as pendingCount } from '@/src/lib/pendingExpenses'
import { readLastSynced } from '@/src/lib/netStatus'

/**
 * One gate for every screen that needs the network and doesn't have it, so
 * a dead connection reads as one deliberate state instead of six different
 * "couldn't load" error branches. Logging an expense is the one thing that
 * still works offline (a locally cached category list, queued for later
 * sync), so it's the only way out of this screen besides reconnecting.
 */
export function OfflineScreen() {
  const { tokens, space, radius } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [pending, setPending] = useState(0)
  const [lastSynced, setLastSynced] = useState<number | null>(null)

  useEffect(() => {
    pendingCount().then(setPending)
    readLastSynced().then(setLastSynced)
  }, [])

  return (
    <View style={[styles.container, { backgroundColor: tokens.bg, paddingTop: insets.top + 24, gap: space.md }]}>
      <View style={[styles.iconBadge, { backgroundColor: tokens.chipActiveBg, borderRadius: radius.full }]}>
        <WifiOff size={26} color={tokens.text3} />
      </View>
      <Text style={[styles.title, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
        You&apos;re offline
      </Text>
      <Text style={[styles.subtitle, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
        You can still log an expense. It&apos;ll sync automatically once you&apos;re back online.
      </Text>
      <Button
        label="Log an expense"
        onPress={() => router.push(LOG_EXPENSE_PATH)}
        style={{ backgroundColor: tokens.accent, marginTop: space.sm }}
      />
      {pending > 0 && (
        <Text style={[styles.caption, { color: tokens.text3, fontFamily: fontFamily.bodyMedium }]}>
          {pending === 1 ? '1 expense waiting to sync' : `${pending} expenses waiting to sync`}
        </Text>
      )}
      {lastSynced != null && (
        <Text style={[styles.caption, { color: tokens.text3, fontFamily: fontFamily.bodyMedium }]}>
          Last synced {formatRelativeTime(lastSynced)}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconBadge: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22 },
  subtitle: { fontSize: 13, textAlign: 'center', maxWidth: 240 },
  caption: { fontSize: 11 },
})
