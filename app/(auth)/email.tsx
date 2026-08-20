import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { ArrowLeft, ShieldCheck } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { Icon } from '@/src/components/shared/Icon'
import { sendMagicAuthCode } from '@/src/api/magicAuth'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Screen 2 (mockup: isEmail). Validates, sends the code, then hands the email
// along as a route param to /(auth)/code — same param-passing convention as
// log-expense.tsx's edit mode.
export default function EmailScreen() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const handleSend = async () => {
    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setError('')
    setPending(true)
    const ok = await sendMagicAuthCode(trimmed)
    setPending(false)
    if (!ok) return setError('Could not send code. Check the address and try again.')
    router.push({ pathname: '/(auth)/code', params: { email: trimmed } })
  }

  return (
    <View style={[styles.container, { backgroundColor: tokens.bg, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 }]}>
      <Pressable onPress={() => router.back()} hitSlop={12} style={[styles.backButton, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
        <Icon icon={ArrowLeft} size={20} color={tokens.text} />
      </Pressable>

      <Text style={[styles.title, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>What's your email?</Text>
      <Text style={[styles.subtitle, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
        We'll send a 6-digit code. If you're new, this creates your account.
      </Text>

      <TextInput
        value={email}
        onChangeText={(v) => {
          setEmail(v)
          setInvalid(false)
        }}
        placeholder="you@example.com"
        placeholderTextColor={tokens.text3}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        onSubmitEditing={handleSend}
        style={[styles.input, { color: tokens.text, backgroundColor: tokens.inputBg, borderColor: tokens.borderStrong, fontFamily: fontFamily.bodyMedium }]}
      />

      {invalid && (
        <Text style={[styles.fieldError, { color: tokens.coral, fontFamily: fontFamily.bodyMedium }]}>
          Enter a valid email address.
        </Text>
      )}
      {error !== '' && (
        <Text style={[styles.fieldError, { color: tokens.coral, fontFamily: fontFamily.bodyMedium }]}>{error}</Text>
      )}

      <Pressable
        onPress={handleSend}
        disabled={pending || !email}
        style={[styles.sendButton, { backgroundColor: tokens.gold, opacity: pending || !email ? 0.6 : 1 }]}
      >
        <Text style={[styles.sendText, { color: tokens.onAccent, fontFamily: fontFamily.displaySemiBold }]}>
          {pending ? 'Sending...' : 'Send code'}
        </Text>
      </Pressable>

      <View style={{ flex: 1 }} />

      <View style={[styles.noteCard, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
        <Icon icon={ShieldCheck} size={16} color={tokens.text2} />
        <Text style={[styles.noteText, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
          Passwords are gone. Sessions live on this device and you can revoke them any time from Account & security.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  backButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, marginTop: 26 },
  subtitle: { fontSize: 14, marginTop: 8, lineHeight: 20 },
  input: { marginTop: 26, borderWidth: 1, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 16, fontSize: 16 },
  fieldError: { fontSize: 13, marginTop: 10 },
  sendButton: { marginTop: 14, minHeight: 54, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  sendText: { fontSize: 15 },
  noteCard: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14, borderWidth: 1, borderRadius: 18 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 18 },
})
