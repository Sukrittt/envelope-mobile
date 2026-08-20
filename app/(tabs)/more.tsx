import { useState } from 'react'
import { View, Text, TextInput, Pressable, Switch, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { AnimatedTabContent } from '@/src/components/nav/AnimatedTabContent'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { clearAccess } from '@/src/api/accessMode'
import { usePrivacy } from '@/src/context/PrivacyContext'
import { useUser, useUpdateUser } from '@/src/hooks/useUser'
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

function providerLabel(provider: string | null | undefined): string {
  if (provider === 'google') return 'Google'
  if (provider) return provider
  return 'email code'
}

export default function MoreScreen() {
  const { tokens, preference, setPreference } = useTheme()
  const { hideAmounts, setHideAmounts } = usePrivacy()
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const userQuery = useUser()
  const updateUser = useUpdateUser()
  const user = userQuery.data

  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  const displayName = user?.name || user?.email || 'You'
  const initial = displayName.trim().charAt(0).toUpperCase() || '?'

  const startEdit = () => {
    setNameDraft(user?.name ?? '')
    setEditingName(true)
  }
  const saveEdit = () => {
    const name = nameDraft.trim()
    setEditingName(false)
    if (name && name !== user?.name) updateUser.mutate({ name })
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 14, backgroundColor: tokens.headerBg, borderBottomColor: tokens.border },
        ]}
      >
        <Text style={[styles.title, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>You</Text>
      </View>

      <AnimatedTabContent>
        <ScrollView
          style={{ flex: 1, backgroundColor: tokens.bg }}
          contentContainerStyle={[styles.container, { paddingTop: 16, paddingBottom: insets.bottom + 40 }]}
        >
          {/* Profile */}
          <View style={[styles.profileCard, { backgroundColor: tokens.card, borderColor: tokens.borderStrong }]}>
            <View style={[styles.avatar, { backgroundColor: tokens.goldSoft, borderColor: tokens.gold }]}>
              <Text style={[styles.avatarText, { color: tokens.gold, fontFamily: fontFamily.displaySemiBold }]}>{initial}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              {editingName ? (
                <TextInput
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  placeholder="Your name"
                  placeholderTextColor={tokens.text3}
                  autoFocus
                  onSubmitEditing={saveEdit}
                  onBlur={saveEdit}
                  style={[styles.nameInput, { color: tokens.text, borderColor: tokens.border, fontFamily: fontFamily.bodyExtraBold }]}
                />
              ) : (
                <Text style={[styles.name, { color: tokens.text, fontFamily: fontFamily.bodyExtraBold }]} numberOfLines={1}>
                  {displayName}
                </Text>
              )}
              {user?.email && (
                <Text style={[styles.email, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]} numberOfLines={1}>
                  {user.email}
                </Text>
              )}
              <View style={styles.signedInRow}>
                <View style={[styles.dot, { backgroundColor: tokens.mint }]} />
                <Text style={[styles.signedInText, { color: tokens.mint, fontFamily: fontFamily.bodyMedium }]}>
                  Signed in with {providerLabel(user?.provider)}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={editingName ? saveEdit : startEdit}
              style={[styles.editButton, { backgroundColor: tokens.inputBg, borderColor: tokens.borderStrong }]}
            >
              <Text style={[styles.editButtonText, { color: tokens.text, fontFamily: fontFamily.bodyBold }]}>
                {editingName ? 'Save' : 'Edit'}
              </Text>
            </Pressable>
          </View>

          {/* FEATURES */}
          <View style={styles.section}>
            <View style={styles.sectionHeadRow}>
              <Text style={[styles.sectionLabel, { color: tokens.text3, fontFamily: fontFamily.bodyBold }]}>FEATURES</Text>
              <Text style={[styles.sectionMeta, { color: tokens.text3, fontFamily: fontFamily.bodyMedium }]}>3 of 5 live</Text>
            </View>
            <View style={styles.featureGrid}>
              <FeatureCard
                icon="🎁"
                label="Expense Wrapped"
                blurb="Your month as a story"
                iconBg={tokens.coralSoft}
                onPress={() => router.push('/wrapped')}
              />
              <FeatureCard
                icon="🧠"
                label="Money Brain"
                blurb="Ask about your spending"
                iconBg={tokens.goldSoft}
                onPress={() => router.push('/modals/money-brain')}
              />
              <FeatureCard
                icon="📈"
                label="Investments"
                blurb="Portfolio at a glance"
                iconBg={tokens.mintSoft}
                onPress={() => router.push('/investments')}
              />
              <View style={[styles.featureCard, styles.featurePlaceholder, { borderColor: tokens.borderStrong }]}>
                <View style={[styles.featureIcon, { backgroundColor: tokens.inputBg }]}>
                  <Text style={{ fontSize: 18, color: tokens.text3 }}>＋</Text>
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
                        style={[styles.segment, { backgroundColor: active ? tokens.gold : 'transparent' }]}
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
                  trackColor={{ false: tokens.borderStrong, true: tokens.gold }}
                  thumbColor={tokens.onAccent}
                />
              </View>
              <View style={[styles.divider, { backgroundColor: tokens.border }]} />
              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>Notifications</Text>
                <View style={[styles.segmented, { backgroundColor: tokens.inputBg }]}>
                  {NOTIFY_OPTIONS.map((opt) => {
                    const active = (user?.notifyCadence ?? 'off') === opt.value
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => updateUser.mutate({ notifyCadence: opt.value })}
                        style={[styles.segment, { backgroundColor: active ? tokens.gold : 'transparent' }]}
                      >
                        <Text style={[styles.segmentText, { color: active ? tokens.onAccent : tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            </View>
          </View>

          {/* ACCOUNT */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: tokens.text3, fontFamily: fontFamily.bodyBold }]}>ACCOUNT</Text>
            <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
              <AccountRow icon="🔐" label="Account & security" onPress={() => router.push('/account/security')} tokens={tokens} />
              <View style={[styles.divider, { backgroundColor: tokens.border }]} />
              <AccountRow icon="🗂️" label="Your data" onPress={() => router.push('/account/data')} tokens={tokens} />
              <View style={[styles.divider, { backgroundColor: tokens.border }]} />
              <View style={styles.row}>
                <Text style={{ fontSize: 16, opacity: 0.5 }}>💳</Text>
                <Text style={[styles.rowLabel, { flex: 1, marginLeft: 12, color: tokens.text3, textDecorationLine: 'line-through', fontFamily: fontFamily.bodySemiBold }]}>
                  Plan & billing
                </Text>
                <View style={[styles.badge, { backgroundColor: tokens.mintSoft }]}>
                  <Text style={[styles.badgeText, { color: tokens.mint, fontFamily: fontFamily.bodyBold }]}>Free & open source</Text>
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: tokens.border }]} />
              <AccountRow icon="💬" label="Help & feedback" onPress={() => router.push('/account/help')} tokens={tokens} />
            </View>
          </View>

          <Pressable
            onPress={() => clearAccess()}
            style={[styles.card, styles.logoutButton, { backgroundColor: 'transparent', borderColor: tokens.coral }]}
          >
            <Text style={[styles.logoutText, { color: tokens.coral, fontFamily: fontFamily.bodySemiBold }]}>Sign out</Text>
          </Pressable>

          <Text style={[styles.version, { color: tokens.text3, fontFamily: fontFamily.bodyMedium }]}>
            v{appJson.expo.version} · built in the open
          </Text>
        </ScrollView>
      </AnimatedTabContent>
    </View>
  )
}

function FeatureCard({
  icon,
  label,
  blurb,
  iconBg,
  onPress,
}: {
  icon: string
  label: string
  blurb: string
  iconBg: string
  onPress: () => void
}) {
  const { tokens } = useTheme()
  return (
    <Pressable onPress={onPress} style={[styles.featureCard, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
      <View style={[styles.featureIcon, { backgroundColor: iconBg }]}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
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
  icon: string
  label: string
  onPress: () => void
  tokens: ReturnType<typeof useTheme>['tokens']
}) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <Text style={[styles.rowLabel, { flex: 1, marginLeft: 12, color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>{label}</Text>
      <Text style={[styles.chevron, { color: tokens.text3 }]}>→</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1 },
  container: { paddingHorizontal: 20, gap: 22 },
  title: { fontSize: 20 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderWidth: 1, borderRadius: 22 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  avatarText: { fontSize: 20 },
  name: { fontSize: 16 },
  nameInput: { fontSize: 16, borderBottomWidth: 1, paddingVertical: 2 },
  email: { fontSize: 12, marginTop: 1 },
  signedInRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  signedInText: { fontSize: 11 },
  editButton: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 100, borderWidth: 1 },
  editButtonText: { fontSize: 12 },
  section: { gap: 10 },
  sectionHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4 },
  sectionLabel: { fontSize: 11, letterSpacing: 0.5, paddingHorizontal: 4 },
  sectionMeta: { fontSize: 11 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  featureCard: { width: '47.5%', gap: 8, padding: 16, borderWidth: 1, borderRadius: 20 },
  featurePlaceholder: { borderStyle: 'dashed' },
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
  chevron: { fontSize: 16, lineHeight: 20, textAlignVertical: 'center' },
  logoutButton: { alignItems: 'center', paddingVertical: 16 },
  logoutText: { fontSize: 14 },
  version: { fontSize: 11, textAlign: 'center' },
})
