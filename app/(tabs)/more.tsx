import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, Switch, ScrollView, ActivityIndicator, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { AnimatedTabContent } from '@/src/components/nav/AnimatedTabContent'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { accessMode, clearAccess, persistAccess, type AccessMode } from '@/src/api/accessMode'
import { verifyToken } from '@/src/api/client'
import { usePrivacy } from '@/src/context/PrivacyContext'
import appJson from '@/app.json'

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
] as const

export default function MoreScreen() {
  const { tokens, preference, setPreference } = useTheme()
  const { hideAmounts, setHideAmounts } = usePrivacy()
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const [mode, setMode] = useState<AccessMode>(accessMode.get())
  const [switching, setSwitching] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => accessMode.subscribe(setMode), [])

  const handleSwitchToReal = async () => {
    if (!password.trim()) return
    setBusy(true)
    setError(null)
    try {
      const ok = await verifyToken(password.trim())
      if (!ok) {
        setError('Wrong password')
        return
      }
      await persistAccess('real', password.trim())
      setSwitching(false)
      setPassword('')
    } catch {
      setError('Could not reach the server — check your connection')
    } finally {
      setBusy(false)
    }
  }

  const handleSwitchToGuest = () => {
    persistAccess('guest')
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 14, backgroundColor: tokens.headerBg, borderBottomColor: tokens.border },
        ]}
      >
        <Text style={[styles.title, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>More</Text>
      </View>

    <AnimatedTabContent>
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.bg }}
      contentContainerStyle={[styles.container, { paddingTop: 12, paddingBottom: insets.bottom + 40 }]}
    >
      {/* Investments */}
      <Pressable
        onPress={() => router.push('/investments')}
        style={[styles.row, styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}
      >
        <View style={styles.rowLeft}>
          <View style={[styles.iconChip, { backgroundColor: tokens.pillBg }]}>
            <Text style={{ fontSize: 15 }}>📈</Text>
          </View>
          <Text style={[styles.rowLabel, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>Investments</Text>
        </View>
        <Text style={[styles.chevron, { color: tokens.text3 }]}>→</Text>
      </Pressable>

      {/* Appearance */}
      <Text style={[styles.sectionLabel, { color: tokens.text3, fontFamily: fontFamily.bodyBold }]}>Appearance</Text>
      <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
        <View style={styles.segmented}>
          {THEME_OPTIONS.map((opt) => {
            const active = preference === opt.value
            return (
              <Pressable
                key={opt.value}
                onPress={() => setPreference(opt.value)}
                style={[
                  styles.segment,
                  { backgroundColor: active ? tokens.gold : 'transparent' },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: active ? tokens.onAccent : tokens.text2, fontFamily: fontFamily.bodySemiBold },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* Privacy */}
      <Text style={[styles.sectionLabel, { color: tokens.text3, fontFamily: fontFamily.bodyBold }]}>Privacy</Text>
      <View style={[styles.row, styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
        <Text style={[styles.rowLabel, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>Hide amounts</Text>
        <Switch
          value={hideAmounts}
          onValueChange={setHideAmounts}
          trackColor={{ false: tokens.borderStrong, true: tokens.gold }}
          thumbColor={tokens.onAccent}
        />
      </View>

      {/* Session */}
      <Text style={[styles.sectionLabel, { color: tokens.text3, fontFamily: fontFamily.bodyBold }]}>Session</Text>
      <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>
            {mode === 'real' ? 'Signed in — real data' : 'Guest mode — demo data'}
          </Text>
        </View>

        {mode === 'guest' && !switching && (
          <Pressable onPress={() => setSwitching(true)} style={styles.innerButton}>
            <Text style={[styles.innerButtonText, { color: tokens.gold, fontFamily: fontFamily.bodySemiBold }]}>
              Switch to real mode
            </Text>
          </Pressable>
        )}

        {mode === 'guest' && switching && (
          <View style={styles.switchForm}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={tokens.text3}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.input,
                { backgroundColor: tokens.inputBg, color: tokens.text, borderColor: tokens.borderStrong, fontFamily: fontFamily.bodyMedium },
              ]}
              onSubmitEditing={handleSwitchToReal}
            />
            {error && (
              <Text style={[styles.error, { color: tokens.coral, fontFamily: fontFamily.bodyMedium }]}>{error}</Text>
            )}
            <View style={styles.switchFormActions}>
              <Pressable
                onPress={() => {
                  setSwitching(false)
                  setPassword('')
                  setError(null)
                }}
                style={styles.innerButton}
              >
                <Text style={[styles.innerButtonText, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleSwitchToReal} disabled={busy} style={styles.innerButton}>
                {busy ? (
                  <ActivityIndicator color={tokens.gold} />
                ) : (
                  <Text style={[styles.innerButtonText, { color: tokens.gold, fontFamily: fontFamily.bodySemiBold }]}>Confirm</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {mode === 'real' && (
          <Pressable onPress={handleSwitchToGuest} style={styles.innerButton}>
            <Text style={[styles.innerButtonText, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>
              Switch to guest mode
            </Text>
          </Pressable>
        )}
      </View>

      <Pressable onPress={() => clearAccess()} style={[styles.card, styles.logoutButton, { backgroundColor: 'transparent', borderColor: tokens.coral }]}>
        <Text style={[styles.logoutText, { color: tokens.coral, fontFamily: fontFamily.bodySemiBold }]}>Log out</Text>
      </Pressable>

      <Text style={[styles.version, { color: tokens.text3, fontFamily: fontFamily.bodyMedium }]}>
        Version {appJson.expo.version}
      </Text>
    </ScrollView>
    </AnimatedTabContent>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1 },
  container: { paddingHorizontal: 20, gap: 8 },
  title: { fontSize: 20 },
  sectionLabel: { fontSize: 12, letterSpacing: 0.5, marginTop: 16, marginBottom: 6, marginLeft: 4 },
  card: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowLabel: { fontSize: 15 },
  iconChip: { width: 34, height: 34, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  chevron: { fontSize: 16, lineHeight: 20, textAlignVertical: 'center' },
  segmented: { flexDirection: 'row', gap: 6, paddingVertical: 10 },
  segment: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  segmentText: { fontSize: 13 },
  innerButton: { paddingVertical: 12, alignItems: 'center' },
  innerButtonText: { fontSize: 14 },
  switchForm: { paddingBottom: 14, gap: 8 },
  switchFormActions: { flexDirection: 'row' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  error: { fontSize: 12 },
  logoutButton: { alignItems: 'center', paddingVertical: 16, marginTop: 20 },
  logoutText: { fontSize: 15 },
  version: { fontSize: 12, textAlign: 'center', marginTop: 20 },
})
