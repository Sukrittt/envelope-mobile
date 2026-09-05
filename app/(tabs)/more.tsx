import { useState, type ReactNode } from 'react'
import { View, Text, Image, Pressable, Switch, Linking, Platform, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { requestPinWidget } from 'react-native-android-widget'
import * as ImagePicker from 'expo-image-picker'
import * as Haptics from 'expo-haptics'
import { Gift, Brain, TrendingUp, Lock, Database, Archive, CreditCard, MessageCircle, Compass, LayoutGrid, ChevronRight, ScanLine, Camera, Images, FileText, type LucideIcon } from 'lucide-react-native'
import { AnimatedTabContent } from '@/src/components/nav/AnimatedTabContent'
import { Screen } from '@/src/components/ui/Screen'
import { Alert } from '@/src/components/ui/AlertHost'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { Icon } from '@/src/components/shared/Icon'
import { LoadingPhrase } from '@/src/components/shared/LoadingPhrase'
import { BottomSheet } from '@/src/components/shared/Modal'
import { clearAccess, sessionId } from '@/src/api/accessMode'
import { revokeSession } from '@/src/api/account'
import { usePrivacy } from '@/src/context/PrivacyContext'
import { monthAbbrev, monthLabel, shiftMonthKey } from '@/src/lib/envelope'
import { setPendingScanImage } from '@/src/lib/pendingScanImage'
import { BASE_URL } from '@/src/api/client'
import { useUser } from '@/src/hooks/useUser'
import { useWrappedStatus } from '@/src/hooks/useWrapped'
import { useCategories } from '@/src/hooks/useCategories'
import { useOnline } from '@/src/lib/netStatus'
import { count as pendingCount } from '@/src/lib/pendingExpenses'
import type { UserProfile } from '@/src/api/account'
import type { WrappedStatus } from '@/src/api/wrapped'
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

  const [signingOut, setSigningOut] = useState(false)
  const [scanPickerOpen, setScanPickerOpen] = useState(false)
  const online = useOnline()

  const userQuery = useUser()
  const user = userQuery.data
  const wrappedStatus = useWrappedStatus().data
  const categoriesQ = useCategories()

  async function doSignOut() {
    // The revoke is a network round-trip (up to apiFetch's 15s timeout),
    // so the button has to say it's working — and refuse a second tap.
    setSigningOut(true)
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
    // No setSigningOut(false): clearAccess unmounts this screen via the
    // root navigator's session guard. Resetting it would only flash
    // "Sign out" back on a screen that is already leaving.
    if (!revoked) {
      Alert.alert('Signed out', "This device is signed out, but we couldn't reach the server to end the session there too.")
    }
  }

  // Scan is a server write (uploads to Gemini, then a manual-entry POST) —
  // it must stand down offline rather than fail partway through a picked photo.
  function openScanPicker() {
    if (!online) {
      Alert.alert("You're offline", "Scan a bill once you're back online, or log this expense manually.")
      return
    }
    setScanPickerOpen(true)
  }

  async function pickBillFrom(source: 'camera' | 'library') {
    Haptics.selectionAsync().catch(() => {})
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      setScanPickerOpen(false)
      Alert.alert('Permission needed', 'Camera/photo access is off. Enable it in Settings, or enter this expense manually.')
      return
    }

    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.5, base64: true }
    const result =
      source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options)
    if (result.canceled || !result.assets?.[0]) {
      setScanPickerOpen(false)
      return
    }

    const asset = result.assets[0]
    if (!asset.base64) {
      setScanPickerOpen(false)
      Alert.alert("Couldn't read that image", 'Try again or enter this expense manually.')
      return
    }
    // The scan route always requires a non-empty category list — guarded here,
    // before the handoff, rather than sending Gemini an empty enum constraint.
    if ((categoriesQ.data ?? []).length === 0) {
      setScanPickerOpen(false)
      Alert.alert('No categories yet', 'Add one first, or enter this expense manually.')
      return
    }

    setPendingScanImage({ base64: asset.base64, mimeType: asset.mimeType ?? 'image/jpeg' })
    setScanPickerOpen(false)
    router.push('/modals/scan-bill')
  }

  const displayName = user?.name || user?.email || 'You'
  const initial = displayName.trim().charAt(0).toUpperCase() || '?'
  const wrappedCard = wrappedCardProps(wrappedStatus, tokens)

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
            </View>
            <View style={styles.featureGrid}>
              <FeatureCard
                icon={wrappedCard.icon}
                label="Expense Wrapped"
                blurb={wrappedCard.blurb}
                iconBg={wrappedCard.iconBg}
                iconColor={wrappedCard.iconColor}
                onPress={wrappedCard.available ? () => router.push('/wrapped') : undefined}
                disabled={!wrappedCard.available}
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
              <FeatureCard
                icon={ScanLine}
                label="Scan a bill"
                blurb="Split a cart or receipt"
                iconBg={tokens.mintSoft}
                iconColor={tokens.mint}
                onPress={openScanPicker}
              />

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
              <AccountRow icon={Archive} label="Archive" onPress={() => router.push('/account/archive')} tokens={tokens} />
              {Platform.OS === 'android' && (
                <>
                  <View style={[styles.divider, { backgroundColor: tokens.border }]} />
                  <AccountRow
                    icon={LayoutGrid}
                    label="Add widget to home screen"
                    onPress={() => void requestPinWidget({ widgetName: 'Envelope' })}
                    tokens={tokens}
                  />
                </>
              )}
              <View style={[styles.divider, { backgroundColor: tokens.border }]} />
              <View style={styles.row}>
                <View style={{ opacity: 0.5 }}>
                  <Icon icon={CreditCard} size={16} color={tokens.text} />
                </View>
                <Text style={[styles.rowLabel, { flex: 1, marginLeft: 12, color: tokens.text3, textDecorationLine: 'line-through', fontFamily: fontFamily.bodySemiBold }]}>
                  Plan & billing
                </Text>
                <Pressable
                  onPress={() => Linking.openURL('https://github.com/Sukrittt/ynab-replacement')}
                  style={[styles.badge, { backgroundColor: tokens.mintSoft }]}
                >
                  <Text style={[styles.badgeText, { color: tokens.mint, fontFamily: fontFamily.bodyBold }]}>Free & open source</Text>
                </Pressable>
              </View>
              <View style={[styles.divider, { backgroundColor: tokens.border }]} />
              <AccountRow icon={Compass} label="How this works" onPress={() => router.push('/account/guided-tour')} tokens={tokens} />
              <View style={[styles.divider, { backgroundColor: tokens.border }]} />
              <AccountRow icon={MessageCircle} label="Help & feedback" onPress={() => router.push('/account/help')} tokens={tokens} />
              <View style={[styles.divider, { backgroundColor: tokens.border }]} />
              <AccountRow
                icon={FileText}
                label="Terms & privacy"
                onPress={() => Linking.openURL(`${BASE_URL}/legal/privacy`)}
                tokens={tokens}
              />
            </View>
          </View>

          <Pressable
            onPress={async () => {
              // A queued offline expense lives only in this device's AsyncStorage,
              // namespaced by user id — signing out doesn't delete it (so signing
              // back in as the same person recovers it), but signing out and back
              // in as someone *else* would leave it stranded with nobody flushing
              // it. Confirm rather than silently letting that happen.
              const waiting = await pendingCount()
              if (waiting > 0) {
                Alert.alert(
                  waiting === 1 ? "1 expense hasn't synced yet" : `${waiting} expenses haven't synced yet`,
                  "Signing out now is fine if you're signing back in as you. Otherwise, reconnect first so they can sync.",
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Sign out anyway', style: 'destructive', onPress: doSignOut },
                  ],
                )
                return
              }
              await doSignOut()
            }}
            disabled={signingOut}
            style={[styles.card, styles.logoutButton, { backgroundColor: 'transparent', borderColor: tokens.coral, opacity: signingOut ? 0.6 : 1 }]}
          >
            <Text style={[styles.logoutText, { color: tokens.coral, fontFamily: fontFamily.bodySemiBold }]}>
              {signingOut ? 'Signing out…' : 'Sign out'}
            </Text>
          </Pressable>

          <Text style={[styles.version, { color: tokens.text3, fontFamily: fontFamily.bodyMedium }]}>
            v{appJson.expo.version} · built in the open
          </Text>
      </Screen>

      <BottomSheet visible={scanPickerOpen} onClose={() => setScanPickerOpen(false)}>
        <Text style={[styles.sheetTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>Scan a bill</Text>
        <View style={{ gap: 8 }}>
          <Pressable
            onPress={() => pickBillFrom('camera')}
            style={[styles.sourceRow, { backgroundColor: tokens.inputBg }]}
          >
            <Camera size={20} color={tokens.text} />
            <Text style={[styles.sourceLabel, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>Take a photo</Text>
          </Pressable>
          <Pressable
            onPress={() => pickBillFrom('library')}
            style={[styles.sourceRow, { backgroundColor: tokens.inputBg }]}
          >
            <Images size={20} color={tokens.text} />
            <Text style={[styles.sourceLabel, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>Choose a screenshot</Text>
          </Pressable>
        </View>
      </BottomSheet>
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
  blurb: ReactNode
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
      {typeof blurb === 'string' ? <Text style={[styles.featureBlurb, { color: tokens.text2 }]}>{blurb}</Text> : blurb}
    </Pressable>
  )
}

/** 10-dot progress tracker toward next month's Wrapped unlock, filled-capped at `goal`. */
function dotTracker(count: number, goal: number): string {
  const filled = Math.min(count, goal)
  return '●'.repeat(filled) + '○'.repeat(goal - filled)
}

const WRAPPED_LOADING_PHRASES = ['Checking last month…', 'Counting transactions…', 'Tallying it up…', 'Almost there…']

function wrappedCardProps(status: WrappedStatus | undefined, tokens: ReturnType<typeof useTheme>['tokens']) {
  if (!status) {
    return {
      icon: Gift,
      iconBg: tokens.coralSoft,
      iconColor: tokens.coral,
      blurb: <LoadingPhrase phrases={WRAPPED_LOADING_PHRASES} color={tokens.text2} style={styles.featureBlurb} />,
      available: false,
    }
  }
  if (status.available) {
    return {
      icon: Gift,
      iconBg: tokens.coralSoft,
      iconColor: tokens.coral,
      blurb: `Your ${monthLabel(status.month)}, wrapped`,
      available: true,
    }
  }

  const { currentMonth, currentMonthCount, minTransactions } = status
  const goalReached = currentMonthCount >= minTransactions
  const nextMonthAbbrev = monthAbbrev(shiftMonthKey(currentMonth, 1))
  const dots = dotTracker(currentMonthCount, minTransactions)
  const label = goalReached
    ? `Wrap unlocks ${nextMonthAbbrev} 1`
    : `${currentMonthCount}/${minTransactions} · unlocks ${nextMonthAbbrev} 1`
  const a11yLabel = goalReached
    ? `${minTransactions} of ${minTransactions} transactions logged. Wrap unlocks ${nextMonthAbbrev} 1.`
    : `${currentMonthCount} of ${minTransactions} transactions logged. Unlocks ${nextMonthAbbrev} 1.`
  const dotsColor = goalReached ? tokens.mint : tokens.text3

  return {
    icon: Gift,
    iconBg: tokens.coralSoft,
    iconColor: tokens.coral,
    available: false,
    blurb: (
      <View accessible accessibilityLabel={a11yLabel}>
        <Text style={[styles.dots, { color: dotsColor }]}>{dots}</Text>
        <Text style={[styles.featureBlurb, { color: tokens.text2 }]}>{label}</Text>
      </View>
    ),
  }
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
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  featureCard: { width: '47.5%', gap: 8, padding: 16, borderWidth: 1, borderRadius: 20 },
  featureCardDisabled: { opacity: 0.5 },
  featureIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featureLabel: { fontSize: 14 },
  featureBlurb: { fontSize: 11, lineHeight: 15 },
  dots: { fontSize: 12, letterSpacing: 2, marginBottom: 3 },
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
  sheetTitle: { fontSize: 17, marginBottom: 12 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 14 },
  sourceLabel: { fontSize: 15 },
})
