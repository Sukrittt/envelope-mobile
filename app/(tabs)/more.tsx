import { useEffect, useState, type ReactNode } from 'react'
import { View, Text, Image, Pressable, Switch, Linking, Platform, StyleSheet, Alert } from 'react-native'
import Animated, { SlideInDown, SlideOutUp } from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { requestPinWidget } from 'react-native-android-widget'
import { Gift, Brain, TrendingUp, Lock, Database, CreditCard, MessageCircle, LayoutGrid, ChevronRight, ScanLine, type LucideIcon } from 'lucide-react-native'
import { AnimatedTabContent } from '@/src/components/nav/AnimatedTabContent'
import { Screen } from '@/src/components/ui/Screen'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { Icon } from '@/src/components/shared/Icon'
import { clearAccess, sessionId } from '@/src/api/accessMode'
import { revokeSession } from '@/src/api/account'
import { usePrivacy } from '@/src/context/PrivacyContext'
import { monthAbbrev, monthLabel, shiftMonthKey } from '@/src/lib/envelope'
import { useUser } from '@/src/hooks/useUser'
import { useWrappedStatus } from '@/src/hooks/useWrapped'
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

  const userQuery = useUser()
  const user = userQuery.data
  const wrappedStatus = useWrappedStatus().data

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
                onPress={() => router.push('/modals/scan-bill')}
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

const LOADING_PHRASES = ['Checking last month…', 'Counting transactions…', 'Tallying it up…', 'Almost there…']

/** Cycles through LOADING_PHRASES, each one sliding up and out as the next slides up from below. */
function LoadingPhrase({ color }: { color: string }) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % LOADING_PHRASES.length), 1800)
    return () => clearInterval(id)
  }, [])
  return (
    <View style={styles.loadingPhraseWrap}>
      <Animated.Text
        key={index}
        entering={SlideInDown.duration(450)}
        exiting={SlideOutUp.duration(450)}
        style={[styles.featureBlurb, styles.loadingPhraseText, { color }]}
      >
        {LOADING_PHRASES[index]}
      </Animated.Text>
    </View>
  )
}

function wrappedCardProps(status: WrappedStatus | undefined, tokens: ReturnType<typeof useTheme>['tokens']) {
  if (!status) {
    return {
      icon: Gift,
      iconBg: tokens.coralSoft,
      iconColor: tokens.coral,
      blurb: <LoadingPhrase color={tokens.text2} />,
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
    : `${currentMonthCount}/${minTransactions} — unlocks ${nextMonthAbbrev} 1`
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
  loadingPhraseWrap: { height: 15, overflow: 'hidden' },
  loadingPhraseText: { position: 'absolute', top: 0, left: 0, right: 0 },
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
