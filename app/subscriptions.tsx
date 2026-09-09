import { View, Text, Pressable, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, Plus } from 'lucide-react-native'
import { OfflineScreen } from '@/src/components/shared/OfflineScreen'
import { useOnline } from '@/src/lib/netStatus'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { Icon } from '@/src/components/shared/Icon'
import { useSubscriptions } from '@/src/hooks/useSubscriptions'
import { useRefresh } from '@/src/hooks/useRefresh'
import { SubscriptionsPanel } from '@/src/components/subscriptions/SubscriptionsPanel'

export default function SubscriptionsScreen() {
  const { tokens } = useTheme()
  const online = useOnline()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { refreshing, onRefresh } = useRefresh()
  const { data: subscriptions = [], isLoading } = useSubscriptions()

  if (!online) return <OfflineScreen />

  return (
    <View style={[styles.container, { backgroundColor: tokens.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: tokens.border }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={[styles.backButton, { backgroundColor: tokens.card, borderColor: tokens.border }]}
        >
          <Icon icon={ArrowLeft} size={20} color={tokens.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>Subscriptions</Text>
        <Pressable
          onPress={() => router.push('/modals/subscription')}
          style={[styles.addButton, { backgroundColor: tokens.card, borderColor: tokens.border }]}
        >
          <Icon icon={Plus} size={16} color={tokens.text} />
          <Text style={[styles.addText, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>Add</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.accent} colors={[tokens.accent]} />}
      >
        <SubscriptionsPanel subscriptions={subscriptions} loading={isLoading} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 19 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 100, borderWidth: 1 },
  addText: { fontSize: 12.5 },
  body: { padding: 16 },
})
