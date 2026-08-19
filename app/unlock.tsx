import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { persistGuest } from '@/src/api/accessMode'
import { useSignIn } from '@/src/api/useSignIn'
import { sendMagicAuthCode, verifyMagicAuthCode } from '@/src/api/magicAuth'

// Renders inline in place of the button's "Unlock" text (the button itself keeps
// its gold background and shape). Fades in, and the shackle tilts open on its
// right foot — like 🔓. The shackle is a plain (non-animated) SVG layered under
// a real Animated.View: RN-SVG's own `rotation`/`origin` props are JS-side
// convenience props that don't repaint correctly when fed a live Animated.Value,
// so the rotation lives in RN's transform/transformOrigin instead.
function UnlockIcon({ color, size = 20 }: { color: string; size?: number }) {
  const opacity = useRef(new Animated.Value(0)).current
  const shackleRotate = useRef(new Animated.Value(0)).current

  useEffect(() => {
    opacity.setValue(0)
    shackleRotate.setValue(0)
    Animated.timing(opacity, { toValue: 1, duration: 200, easing: Easing.ease, useNativeDriver: true }).start()
    Animated.timing(shackleRotate, {
      toValue: 1,
      duration: 350,
      delay: 150,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start()
  }, [])

  return (
    <Animated.View style={{ width: size, height: size, opacity }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={StyleSheet.absoluteFill}>
        <Rect x={3} y={11} width={18} height={11} rx={2} ry={2} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            // Pivot at the shackle's right foot (17,11) in the 24x24 icon box.
            transformOrigin: ['70.8%', '45.8%', 0],
            transform: [{ rotate: shackleRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '20deg'] }) }],
          },
        ]}
      >
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </Animated.View>
  )
}

export default function UnlockScreen() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { signIn, pending, done: googleDone, error } = useSignIn()
  const shake = useRef(new Animated.Value(0)).current

  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [magicPending, setMagicPending] = useState(false)
  const [magicDone, setMagicDone] = useState(false)
  const [magicError, setMagicError] = useState('')

  const done = googleDone || magicDone
  const shownError = error || magicError

  // Mirrors web's @keyframes auth-shake: 0.4s, 10 steps of 40ms, same px amplitude.
  const triggerShake = () => {
    shake.setValue(0)
    const steps = [-1, 2, -4, 4, -4, 4, -4, 2, -1, 0]
    Animated.sequence(
      steps.map((v) => Animated.timing(shake, { toValue: v, duration: 40, useNativeDriver: true })),
    ).start()
  }

  // Shake on a failed sign-in, same beat as the old wrong-password shake.
  useEffect(() => {
    if (shownError) triggerShake()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownError])

  const handleGuest = async () => {
    await persistGuest()
    router.replace('/(tabs)')
  }

  const handleSendCode = async () => {
    setMagicPending(true)
    setMagicError('')
    const ok = await sendMagicAuthCode(email)
    setMagicPending(false)
    if (!ok) return setMagicError('Could not send code. Check the address and try again.')
    setStep('code')
  }

  const handleVerifyCode = async () => {
    setMagicPending(true)
    setMagicError('')
    const ok = await verifyMagicAuthCode(email, code)
    setMagicPending(false)
    if (!ok) return setMagicError('Wrong or expired code.')
    setMagicDone(true)
  }

  // Let the inline unlock icon finish its animation before navigating away —
  // same 1100ms beat as CheckIcon usages elsewhere in the app. The session is
  // already stored by the time `done` flips; this is purely the flourish.
  useEffect(() => {
    if (!done) return
    const timer = setTimeout(() => router.replace('/(tabs)'), 1100)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  return (
    <View style={[styles.container, { backgroundColor: tokens.bg, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Animated.View style={{ transform: [{ translateX: shake }] }}>
        <Text style={[styles.greeting, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
          Hey Sukrit 👋
        </Text>
        <Text style={[styles.subtitle, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
          Sign in to unlock your dashboard
        </Text>

        {shownError && (
          <Text style={[styles.error, { color: tokens.coral, fontFamily: fontFamily.bodyMedium }]}>
            {shownError}
          </Text>
        )}
      </Animated.View>

      <Pressable
        onPress={signIn}
        disabled={pending || magicPending || done}
        style={[styles.button, { backgroundColor: done ? tokens.mint : tokens.gold }]}
      >
        {done ? (
          <UnlockIcon color={tokens.onAccent} />
        ) : (
          <Text style={[styles.buttonText, { color: tokens.onAccent, fontFamily: fontFamily.displaySemiBold }]}>
            {pending ? 'Signing in...' : 'Continue with Google'}
          </Text>
        )}
      </Pressable>

      {!done && (
        <>
          <Text style={[styles.orText, { color: tokens.text3, fontFamily: fontFamily.bodyMedium }]}>or</Text>

          {step === 'email' ? (
            <>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={tokens.text3}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, { color: tokens.text, backgroundColor: tokens.inputBg, borderColor: tokens.border, fontFamily: fontFamily.bodyMedium }]}
              />
              <Pressable
                onPress={handleSendCode}
                disabled={magicPending || !email || pending}
                style={[styles.secondaryButton, { borderColor: tokens.border }]}
              >
                <Text style={[styles.secondaryButtonText, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>
                  {magicPending ? 'Sending...' : 'Send code'}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={[styles.subtitle, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
                Enter the code sent to {email}
              </Text>
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                placeholderTextColor={tokens.text3}
                keyboardType="number-pad"
                style={[styles.input, { color: tokens.text, backgroundColor: tokens.inputBg, borderColor: tokens.border, fontFamily: fontFamily.bodyMedium }]}
                autoFocus
              />
              <Pressable
                onPress={handleVerifyCode}
                disabled={magicPending || !code}
                style={[styles.secondaryButton, { borderColor: tokens.border }]}
              >
                <Text style={[styles.secondaryButtonText, { color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>
                  {magicPending ? 'Verifying...' : 'Verify'}
                </Text>
              </Pressable>
            </>
          )}
        </>
      )}

      <Pressable onPress={handleGuest} style={styles.guestLink}>
        <Text style={[styles.guestText, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
          Continue as guest
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  greeting: { fontSize: 26, textAlign: 'center' },
  subtitle: { fontSize: 14, marginTop: 6, marginBottom: 8, textAlign: 'center' },
  error: { fontSize: 13, marginTop: 10, textAlign: 'left' },
  button: { borderRadius: 28, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  buttonText: { fontSize: 15 },
  orText: { fontSize: 12, textAlign: 'center', marginTop: 18, marginBottom: 14 },
  input: { borderWidth: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, fontSize: 15 },
  secondaryButton: { borderWidth: 1, borderRadius: 28, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  secondaryButtonText: { fontSize: 14 },
  guestLink: { alignItems: 'center', marginTop: 18 },
  guestText: { fontSize: 13, textDecorationLine: 'underline' },
})
