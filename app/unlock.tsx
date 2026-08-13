import { useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { verifyToken } from '@/src/api/client'
import { persistAccess } from '@/src/api/accessMode'

export default function UnlockScreen() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUnlock = async () => {
    if (!password.trim()) return
    setLoading(true)
    setError(null)
    try {
      const ok = await verifyToken(password.trim())
      if (!ok) {
        setError('Wrong password')
        return
      }
      await persistAccess('real', password.trim())
      router.replace('/(tabs)')
    } catch {
      setError('Could not reach the server — check your connection')
    } finally {
      setLoading(false)
    }
  }

  const handleGuest = async () => {
    await persistAccess('guest')
    router.replace('/(tabs)')
  }

  return (
    <View style={[styles.container, { backgroundColor: tokens.bg, paddingTop: insets.top + 40 }]}>
      <Text style={[styles.greeting, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
        Hey Sukrit 👋
      </Text>
      <Text style={[styles.subtitle, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
        Enter your password to unlock Mission Control
      </Text>

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
        onSubmitEditing={handleUnlock}
      />

      {error && (
        <Text style={[styles.error, { color: tokens.coral, fontFamily: fontFamily.bodyMedium }]}>{error}</Text>
      )}

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
  container: { flex: 1, paddingHorizontal: 24 },
  greeting: { fontSize: 26 },
  subtitle: { fontSize: 14, marginTop: 6, marginBottom: 32 },
  input: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15 },
  error: { fontSize: 13, marginTop: 10 },
  button: { borderRadius: 28, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  buttonText: { fontSize: 15 },
  guestLink: { alignItems: 'center', marginTop: 18 },
  guestText: { fontSize: 13, textDecorationLine: 'underline' },
})
