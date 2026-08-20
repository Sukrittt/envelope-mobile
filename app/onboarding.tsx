import { useState } from 'react'
import { View, Text, Image, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { updateUser } from '@/src/api/account'

// ponytail: real per-screen light/dark screenshots (assets/onboarding/slide-N-{light,dark}.png)
// still need to be captured from the running app and dropped in here — using the
// app icon as a placeholder art card keeps this screen shippable without a simulator.
const PLACEHOLDER_ART = require('@/assets/icon.png')

const SLIDES = [
  { title: 'Give every rupee a job', body: 'Income lands in Ready to Assign. Move it into envelopes — rent, food, football — until nothing is unassigned.' },
  { title: 'Log in three taps', body: 'The + button in the tab bar takes an amount, an envelope, and a note. That’s the whole ritual.' },
  { title: 'Money Brain watches for you', body: 'Ask it anything about your month, and get a Wrapped recap when the month closes. Both live under You.' },
] as const

export default function OnboardingScreen() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [finishing, setFinishing] = useState(false)

  // Best-effort: the tour-completion flag is low-stakes, so a flaky PATCH must
  // never trap the user on this screen.
  const finish = async () => {
    if (finishing) return
    setFinishing(true)
    await updateUser({ onboardedAt: new Date().toISOString() }).catch(() => {})
    router.replace('/(tabs)')
  }

  const handleNext = () => {
    if (step >= SLIDES.length - 1) {
      finish()
      return
    }
    setStep((s) => s + 1)
  }

  const slide = SLIDES[step]

  return (
    <View style={[styles.container, { backgroundColor: tokens.bg, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.topRow}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { width: i === step ? 22 : 7, backgroundColor: i === step ? tokens.gold : tokens.borderStrong },
              ]}
            />
          ))}
        </View>
        <Pressable onPress={finish} disabled={finishing} hitSlop={8}>
          <Text style={[styles.skip, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>Skip tour</Text>
        </Pressable>
      </View>

      <View style={[styles.artCard, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
        <Image source={PLACEHOLDER_ART} style={styles.art} resizeMode="contain" />
      </View>

      <View style={styles.copy}>
        <Text style={[styles.title, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>{slide.title}</Text>
        <Text style={[styles.body, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>{slide.body}</Text>
      </View>

      <View style={{ flex: 1 }} />

      <Pressable onPress={handleNext} disabled={finishing} style={[styles.cta, { backgroundColor: tokens.gold, opacity: finishing ? 0.6 : 1 }]}>
        <Text style={[styles.ctaText, { color: tokens.onAccent, fontFamily: fontFamily.displaySemiBold }]}>
          {step >= SLIDES.length - 1 ? 'Start budgeting' : 'Next'}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { height: 7, borderRadius: 100 },
  skip: { fontSize: 13 },
  artCard: { marginTop: 28, borderRadius: 24, borderWidth: 1, height: 190, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  art: { width: '55%', height: '55%' },
  copy: { marginTop: 24 },
  title: { fontSize: 26 },
  body: { fontSize: 15, marginTop: 10, lineHeight: 23 },
  cta: { minHeight: 54, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 15 },
})
