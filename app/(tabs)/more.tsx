import { View, Text, Image, Pressable, Switch, Linking, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { Gift, Brain, TrendingUp, Plus, Lock, Database, CreditCard, MessageCircle, ChevronRight, type LucideIcon } from 'lucide-react-native'
import { AnimatedTabContent } from '@/src/components/nav/AnimatedTabContent'
import { Screen } from '@/src/components/ui/Screen'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { Icon } from '@/src/components/shared/Icon'
import { clearAccess, sessionId } from '@/src/api/accessMode'
import { revokeSession } from '@/src/api/account'
import { usePrivacy } from '@/src/context/PrivacyContext'
import { monthLabel } from '@/src/lib/envelope'
import { useUser } from '@/src/hooks/useUser'
import { useWrappedStatus } from '@/src/hooks/useWrapped'
import type { UserProfile } from '@/src/api/account'
import appJson from '@/app.json'

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Auto' },
] as const

const NOTIFY_OPTIONS: { value: NonNullable<UserProfile['notifyCadence']>; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'daily', label: 'Daily' },
]

export default function MoreScreen() {
  const { tokens, preference, setPreference } = useTheme()
  const { hideAmounts, setHideAmounts } = usePrivacy()
  const router = useRouter()

  const userQuery = useUser()
  const user = userQuery.data
  const wrappedStatus = useWrappedStatus().data

  const displayName = user?.name || user?.email || 'You'
  const initial = displayName.trim().charAt(0).toUpperCase() || '?'

  return (
    <AnimatedTabContent>
      <Screen title="You" contentContainerStyle={styles.container}>
          {/* Profile */}
          <Pressable
            onPress={() => router.push('/account/security')}
            style={[styles.profileCard, { backgroundColor: tokens.card, borderColor: tokens.borderStrong }]}
          >
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={[styles.avatar, { borderColor: tokens.accent }]} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: tokens.accentSoft, borderColor: tokens.accent }]}>
                <Text style={[styles.avatarText, { color: tokens.accentInk, fontFamily: fontFamily.displaySemiBold }]}>{initial}</Text>
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.name, { color: tokens.text, fontFamily: fontFamily.bodyExtraBold }]} numberOfLines={1}>
                {displayName}
              </Text>
              {user?.email && (
                <Text style={[styles.email, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]} numberOfLines={1}>
                  {user.email}
                </Text>
              )}
            </View>
            <ChevronRight size={16} color={tokens.text3} strokeWidth={2} />
          </Pressable>

          {/* FEATURES */}
          <View style={styles.section}>
            <View style={styles.sectionHeadRow}>
              <Text style={[styles.sectionLabel, { color: tokens.text3, fontFamily: fontFamily.bodyBold }]}>FEATURES</Text>
              <Text style={[styles.sectionMeta, { color: tokens.text3, fontFamily: fontFamily.bodyMedium }]}>3 of 5 live</Text>
            </View>
            <View style={styles.featureGrid}>
              <FeatureCard
                icon={Gift}
                label="Expense Wrapped"
                blurb={
                  wrappedStatus?.available
                    ? `Your ${monthLabel(wrappedStatus.month)}, wrapped`
                    : `Log ${wrappedStatus?.minTransactions ?? 10}+ expenses in a month to unlock`
                }
                iconBg={tokens.coralSoft}
                iconColor={tokens.coral}
                onPress={wrappedStatus?.available ? () => router.push('/wrapped') : undefined}
                disabled={!wrappedStatus?.available}
              />
              <FeatureCard
                icon={Brain}
                label="Money Brain"
                blurb="Ask about your spending"
                iconBg={tokens.accentSoft}
                iconColor={tokens.accent}
                onPress={() => router.push('/modals/money-brain')}
              />
              <FeatureCard
                icon={TrendingUp}
                label="Investments"
                blurb="Portfolio at a glance"
                iconBg={tokens.mintSoft}
                iconColor={tokens.mint}
                onPress={() => router.push('/investments')}
              />
              <View style={[styles.featureCard, styles.featurePlaceholder, { borderColor: tokens.borderStrong }]}>
                <View style={[styles.featureIcon, { backgroundColor: tokens.inputBg }]}>
                  <Icon icon={Plus} size={18} color={tokens.text3} />
                </View>
                <Text style={[styles.featureLabel, { color: tokens.text2 }]}>Next feature</Text>
                <Text style={[styles.featureBlurb, { color: tokens.text3 }]}>drop a card here</Text>
              </View>
            </View>
          </View>

          {/* PREFERENCES */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: tokens.text3, fontFamily: fontFamily.bodyBold }]}>PREFERENCES</Text>
            <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>Appearance</Text>
                <View style={[styles.segmented, { backgroundColor: tokens.inputBg }]}>
                  {THEME_OPTIONS.map((opt) => {
                    const active = preference === opt.value
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => setPreference(opt.value)}
                        style={[styles.segment, { backgroundColor: active ? tokens.accent : 'transparent' }]}
                      >
                        <Text style={[styles.segmentText, { color: active ? tokens.onAccent : tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: tokens.border }]} />
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>Hide amounts</Text>
                  <Text style={[styles.rowHint, { color: tokens.text2 }]}>Blur balances when the app opens</Text>
                </View>
                <Switch
                  value={hideAmounts}
                  onValueChange={setHideAmounts}
                  trackColor={{ false: tokens.borderStrong, true: tokens.accent }}
                  thumbColor={tokens.onAccent}
                />
              </View>
              <View style={[styles.divider, { backgroundColor: tokens.border }]} />
              <Pressable onPress={() => router.push('/account/notifications')} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>Notifications</Text>
                  <Text style={[styles.rowHint, { color: tokens.text2 }]}>
                    {NOTIFY_OPTIONS.find((o) => o.value === (user?.notifyCadence ?? 'off'))?.label}
                  </Text>
                </View>
                <ChevronRight size={16} color={tokens.text3} strokeWidth={2} />
              </Pressable>
            </View>
          </View>

          {/* ACCOUNT */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: tokens.text3, fontFamily: fontFamily.bodyBold }]}>ACCOUNT</Text>
            <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
              <AccountRow icon={Lock} label="Account & security" onPress={() => router.push('/account/security')} tokens={tokens} />
              <View style={[styles.divider, { backgroundColor: tokens.border }]} />
              <AccountRow icon={Database} label="Your data" onPress={() => router.push('/account/data')} tokens={tokens} />
              <View style={[styles.divider, { backgroundColor: tokens.border }]} />
              <View style={styles.row}>
                <View style={{ opacity: 0.5 }}>
                  <Icon icon={CreditCard} size={16} color={tokens.text} />
                </View>
                <Text style={[styles.rowLabel, { flex: 1, marginLeft: 12, color: tokens.text3, textDecorationLine: 'line-through', fontFamily: fontFamily.bodySemiBold }]}>
                  Plan & billing
                </Text>
                <Pressable
                  onPress={() => Linking.openURL('https://github.com/Sukrittt/envelope-mobile')}
                  style={[styles.badge, { backgroundColor: tokens.mintSoft }]}
                >
                  <Text style={[styles.badgeText, { color: tokens.mint, fontFamily: fontFamily.bodyBold }]}>Free & open source</Text>
                </Pressable>
              </View>
              <View style={[styles.divider, { backgroundColor: tokens.border }]} />
              <AccountRow icon={MessageCircle} label="Help & feedback" onPress={() => router.push('/account/help')} tokens={tokens} />
            </View>
          </View>

          <Pressable
            onPress={async () => {
              // Revoke server-side first, while the bearer token is still live —
              // clearAccess() below drops it. A failure here only means the WorkOS
              // session outlives this device; sign out locally either way.
              const sid = sessionId()
              let revoked = true
              if (sid) {
                try {
                  await revokeSession(sid)
                } catch {
                  revoked = false
                }
              }
              await clearAccess()
              if (!revoked) {
                Alert.alert('Signed out', "This device is signed out, but we couldn't reach the server to end the session there too.")
              }
            }}
            style={[styles.card, styles.logoutButton, { backgroundColor: 'transparent', borderColor: tokens.coral }]}
          >
            <Text style={[styles.logoutText, { color: tokens.coral, fontFamily: fontFamily.bodySemiBold }]}>Sign out</Text>
          </Pressable>

          <Text style={[styles.version, { color: tokens.text3, fontFamily: fontFamily.bodyMedium }]}>
            v{appJson.expo.version} · built in the open
          </Text>
      </Screen>
    </AnimatedTabContent>
  )
}

function FeatureCard({
  icon,
  label,
  blurb,
  iconBg,
  iconColor,
  onPress,
  disabled,
}: {
  icon: LucideIcon
  label: string
  blurb: string
  iconBg: string
  iconColor: string
  onPress?: () => void
  disabled?: boolean
}) {
  const { tokens } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.featureCard, { backgroundColor: tokens.card, borderColor: tokens.border }, disabled && styles.featureCardDisabled]}
    >
      <View style={[styles.featureIcon, { backgroundColor: iconBg }]}>
        <Icon icon={icon} size={18} color={iconColor} />
      </View>
      <Text style={[styles.featureLabel, { color: tokens.text, fontFamily: fontFamily.bodyExtraBold }]}>{label}</Text>
      <Text style={[styles.featureBlurb, { color: tokens.text2 }]}>{blurb}</Text>
    </Pressable>
  )
}

function AccountRow({
  icon,
  label,
  onPress,
  tokens,
}: {
  icon: LucideIcon
  label: string
  onPress: () => void
  tokens: ReturnType<typeof useTheme>['tokens']
}) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Icon icon={icon} size={16} />
      <Text style={[styles.rowLabel, { flex: 1, marginLeft: 12, color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>{label}</Text>
      <ChevronRight size={16} color={tokens.text3} strokeWidth={2} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: { gap: 22, paddingTop: 4 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderWidth: 1, borderRadius: 22 },
  avatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 1 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20 },
  name: { fontSize: 16 },
  email: { fontSize: 12, marginTop: 1 },
  section: { gap: 10 },
  sectionHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4 },
  sectionLabel: { fontSize: 11, letterSpacing: 0.5, paddingHorizontal: 4 },
  sectionMeta: { fontSize: 11 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  featureCard: { width: '47.5%', gap: 8, padding: 16, borderWidth: 1, borderRadius: 20 },
  featurePlaceholder: { borderStyle: 'dashed' },
  featureCardDisabled: { opacity: 0.5 },
  featureIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featureLabel: { fontSize: 14 },
  featureBlurb: { fontSize: 11, lineHeight: 15 },
  card: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, gap: 12 },
  rowLabel: { fontSize: 14 },
  rowHint: { fontSize: 11, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth },
  segmented: { flexDirection: 'row', gap: 3, padding: 3, borderRadius: 100 },
  segment: { borderRadius: 100, paddingHorizontal: 12, paddingVertical: 8 },
  segmentText: { fontSize: 11 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100 },
  badgeText: { fontSize: 11 },
  logoutButton: { alignItems: 'center', paddingVertical: 16 },
  logoutText: { fontSize: 14 },
  version: { fontSize: 11, textAlign: 'center' },
})
