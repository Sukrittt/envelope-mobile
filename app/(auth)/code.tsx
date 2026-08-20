import { useEffect, useRef, useState } from 'react'
import { Animated, View, Text, Pressable, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { sendMagicAuthCode, verifyMagicAuthCode } from '@/src/api/magicAuth'
import { CodeBoxes } from '@/src/components/auth/CodeBoxes'
import { Numpad } from '@/src/components/auth/Numpad'
import { ResendTimer } from '@/src/components/auth/ResendTimer'
import { UnlockIcon } from '@/src/components/shared/UnlockIcon'
import { Icon } from '@/src/components/shared/Icon'

// Screen 3 (mockup: isCode). Custom numpad is a deliberate mockup choice, not
// the system keyboard. Auto-verifies once 6 digits are in, mirroring the
// mockup's pressKey auto-advance.
export default function CodeScreen() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { email: emailParam } = useLocalSearchParams<{ email: string }>()
  const email = typeof emailParam === 'string' ? emailParam : ''
  const shake = useRef(new Animated.Value(0)).current

  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const triggerShake = () => {
    shake.setValue(0)
    const steps = [-1, 2, -4, 4, -4, 4, -4, 2, -1, 0]
    Animated.sequence(steps.map((v) => Animated.timing(shake, { toValue: v, duration: 40, useNativeDriver: true }))).start()
  }

  useEffect(() => {
    if (code.length !== 6 || pending || done) return
    let cancelled = false
    setPending(true)
    setError('')
    verifyMagicAuthCode(email, code).then((ok) => {
      if (cancelled) return
      setPending(false)
      if (ok) {
        setDone(true)
      } else {
        setError('Wrong or expired code.')
        setCode('')
        triggerShake()
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  // Same 1100ms flourish beat as welcome.tsx's Google success.
  useEffect(() => {
    if (!done) return
    const timer = setTimeout(() => router.replace('/(tabs)'), 1100)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  return (
    <View style={[styles.container, { backgroundColor: tokens.bg, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
      <Pressable onPress={() => router.replace('/(auth)/email')} hitSlop={12} style={[styles.backButton, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
        <Icon icon={ArrowLeft} size={20} color={tokens.text} />
      </Pressable>

      <Text style={[styles.title, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>Check your inbox</Text>
      <Text style={[styles.subtitle, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
        Code sent to <Text style={{ color: tokens.text, fontFamily: fontFamily.bodyBold }}>{email}</Text>
      </Text>

      <Animated.View style={{ transform: [{ translateX: shake }], marginTop: 26 }}>
        <CodeBoxes code={code} />
      </Animated.View>

      {error !== '' && (
        <Text style={[styles.error, { color: tokens.coral, fontFamily: fontFamily.bodyMedium }]}>{error}</Text>
      )}
      <ResendTimer onResend={() => sendMagicAuthCode(email)} />

      <View style={{ flex: 1 }} />

      {done ? (
        <View style={styles.doneWrap}>
          <UnlockIcon color={tokens.mint} size={28} />
        </View>
      ) : (
        <Numpad
          disabled={pending}
          onDigit={(d) => setCode((c) => (c.length >= 6 ? c : c + d))}
          onBackspace={() => setCode((c) => c.slice(0, -1))}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  backButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, marginTop: 26 },
  subtitle: { fontSize: 14, marginTop: 8, lineHeight: 20 },
  error: { fontSize: 13, marginTop: 10 },
  doneWrap: { alignItems: 'center', paddingVertical: 20 },
})
