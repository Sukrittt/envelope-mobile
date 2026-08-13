import { useRef, useState } from 'react'
import { Animated, View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import Svg, { Path, Circle } from 'react-native-svg'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { verifyToken } from '@/src/api/client'
import { persistAccess } from '@/src/api/accessMode'

function EyeIcon({ open, color }: { open: boolean; color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {open ? (
        <>
          <Path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
          <Circle cx={12} cy={12} r={3} />
        </>
      ) : (
        <>
          <Path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
          <Path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
          <Path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
          <Path d="m2 2 20 20" />
        </>
      )}
    </Svg>
  )
}

export default function UnlockScreen() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const shake = useRef(new Animated.Value(0)).current

  // Mirrors web's @keyframes auth-shake: 0.4s, 10 steps of 40ms, same px amplitude.
  const triggerShake = () => {
    shake.setValue(0)
    const steps = [-1, 2, -4, 4, -4, 4, -4, 2, -1, 0]
    Animated.sequence(
      steps.map((v) => Animated.timing(shake, { toValue: v, duration: 40, useNativeDriver: true })),
    ).start()
  }

  const handleUnlock = async () => {
    if (!password.trim()) return
    setLoading(true)
    setError(null)
    try {
      const ok = await verifyToken(password.trim())
      if (!ok) {
        setError('Incorrect password. Try again.')
        triggerShake()
        return
      }
      await persistAccess('real', password.trim())
      router.replace('/(tabs)')
    } catch {
      setError('Could not reach the server — check your connection')
      triggerShake()
    } finally {
      setLoading(false)
    }
  }

  const handleGuest = async () => {
    await persistAccess('guest')
    router.replace('/(tabs)')
  }

  return (
    <View style={[styles.container, { backgroundColor: tokens.bg, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Animated.View style={{ transform: [{ translateX: shake }] }}>
        <Text style={[styles.greeting, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
          Hey Sukrit 👋
        </Text>
        <Text style={[styles.subtitle, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
          Enter your password to unlock Mission Control
        </Text>

        <View style={styles.inputWrap}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={tokens.text3}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              { backgroundColor: tokens.inputBg, color: tokens.text, borderColor: error ? tokens.coral : tokens.borderStrong, fontFamily: fontFamily.bodyMedium },
            ]}
            onSubmitEditing={handleUnlock}
          />
          <Pressable
            onPress={() => setShowPassword((s) => !s)}
            hitSlop={8}
            style={styles.eyeButton}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            <EyeIcon open={showPassword} color={tokens.text3} />
          </Pressable>
        </View>

        {error && (
          <Text style={[styles.error, { color: tokens.coral, fontFamily: fontFamily.bodyMedium }]}>{error}</Text>
        )}
      </Animated.View>

      <Pressable
        onPress={handleUnlock}
        disabled={loading}
        style={[styles.button, { backgroundColor: tokens.gold }]}
      >
        {loading ? (
          <ActivityIndicator color={tokens.onAccent} />
        ) : (
          <Text style={[styles.buttonText, { color: tokens.onAccent, fontFamily: fontFamily.displaySemiBold }]}>
            Unlock
          </Text>
        )}
      </Pressable>

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
  subtitle: { fontSize: 14, marginTop: 6, marginBottom: 32, textAlign: 'center' },
  inputWrap: { position: 'relative', justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingRight: 44, paddingVertical: 14, fontSize: 15 },
  eyeButton: { position: 'absolute', right: 14, height: '100%', justifyContent: 'center', alignItems: 'center' },
  error: { fontSize: 13, marginTop: 10, textAlign: 'left' },
  button: { borderRadius: 28, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  buttonText: { fontSize: 15 },
  guestLink: { alignItems: 'center', marginTop: 18 },
  guestText: { fontSize: 13, textDecorationLine: 'underline' },
})
