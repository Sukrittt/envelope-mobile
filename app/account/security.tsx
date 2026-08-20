import { useState } from 'react'
import { View, Text, Pressable, ScrollView, Alert, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, Check } from 'lucide-react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { Icon } from '@/src/components/shared/Icon'
import { clearAccess } from '@/src/api/accessMode'
import { deleteAccount } from '@/src/api/account'
import { useUser } from '@/src/hooks/useUser'

export default function SecurityScreen() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const userQuery = useUser()
  const user = userQuery.data
  const [deleting, setDeleting] = useState(false)

  const googleLinked = user?.provider === 'google'

  const confirmDelete = () => {
    Alert.alert(
      'Delete account',
      'Removes envelopes, transactions and recaps. Export your data first — this can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true)
            try {
              await deleteAccount()
              await clearAccess()
              router.replace('/(auth)/welcome')
            } catch {
              setDeleting(false)
              Alert.alert('Could not delete account', 'Check your connection and try again.')
            }
          },
        },
      ],
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: tokens.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: tokens.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={[styles.backButton, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
          <Icon icon={ArrowLeft} size={20} color={tokens.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>Account & security</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}>
        <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
          <View style={styles.block}>
            <Text style={[styles.label, { color: tokens.text3 }]}>EMAIL</Text>
            <Text style={[styles.email, { color: tokens.text, fontFamily: fontFamily.bodyBold }]} numberOfLines={1}>
              {user?.email ?? '—'}
            </Text>
            <View style={styles.verifiedRow}>
              <Icon icon={Check} size={14} color={tokens.mint} />
              <Text style={[styles.verified, { color: tokens.mint, fontFamily: fontFamily.bodyMedium }]}>Verified</Text>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: tokens.border }]} />
          <View style={styles.row}>
            <View style={[styles.gBadge, { backgroundColor: tokens.inputBg, borderColor: tokens.borderStrong }]}>
              <Text style={[styles.gBadgeText, { color: tokens.gold, fontFamily: fontFamily.displaySemiBold }]}>G</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: tokens.text, fontFamily: fontFamily.bodyBold }]}>Google</Text>
              <Text style={[styles.rowHint, { color: tokens.text2 }]}>{googleLinked ? 'Linked' : 'Not linked'}</Text>
            </View>
          </View>
        </View>

        <Pressable onPress={() => clearAccess()} style={styles.signOutEverywhere}>
          <Text style={[styles.signOutText, { color: tokens.gold, fontFamily: fontFamily.bodyBold }]}>Sign out everywhere</Text>
        </Pressable>

        <View style={[styles.dangerCard, { borderColor: tokens.coral }]}>
          <Text style={[styles.dangerTitle, { color: tokens.coral, fontFamily: fontFamily.bodyExtraBold }]}>Delete account</Text>
          <Text style={[styles.dangerBody, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
            Removes envelopes, transactions and recaps. Export your data first — this can't be undone.
          </Text>
          <Pressable
            onPress={confirmDelete}
            disabled={deleting}
            style={[styles.dangerButton, { backgroundColor: tokens.coral, opacity: deleting ? 0.6 : 1 }]}
          >
            <Text style={[styles.dangerButtonText, { color: tokens.onAccent, fontFamily: fontFamily.bodyBold }]}>
              {deleting ? 'Deleting…' : 'Delete permanently'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  backButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 19 },
  scrollContent: { padding: 16, gap: 20 },
  card: { borderWidth: 1, borderRadius: 20, overflow: 'hidden' },
  block: { padding: 16 },
  label: { fontSize: 11 },
  email: { fontSize: 14, marginTop: 6 },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  verified: { fontSize: 11 },
  divider: { height: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  gBadge: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  gBadgeText: { fontSize: 13 },
  rowLabel: { fontSize: 14 },
  rowHint: { fontSize: 11, marginTop: 2 },
  signOutEverywhere: { alignSelf: 'flex-start', paddingVertical: 6 },
  signOutText: { fontSize: 13 },
  dangerCard: { padding: 16, borderWidth: 1, borderRadius: 20 },
  dangerTitle: { fontSize: 14 },
  dangerBody: { fontSize: 12, marginTop: 6, lineHeight: 18 },
  dangerButton: { marginTop: 12, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 11, borderRadius: 100 },
  dangerButtonText: { fontSize: 13 },
})
