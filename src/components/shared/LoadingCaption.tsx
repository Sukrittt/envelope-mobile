import { useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'

const PHRASES = [
  'Balancing the envelopes…',
  'Giving every rupee a job…',
  "Counting what's Ready to Assign…",
  "Chasing down last month's leftovers…",
  'Reconciling the chaos…',
  'Squeezing blood from the Bills envelope…',
  'Asking Rent to behave…',
  'Tallying the damage…',
  'Waking up the ledger…',
  "Making sure nothing's overspent (yet)…",
  'Checking if Groceries survived the week…',
  'Persuading Math to add up…',
  'Finding where all the money went…',
  'Teaching your budget to Budget…',
  'Begging the spending trend to flatten…',
  'Hoping the credit card behaves…',
  'Refreshing your financial reality…',
]

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

interface Props {
  style?: StyleProp<ViewStyle>
}

export function LoadingCaption({ style }: Props) {
  const { tokens } = useTheme()
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [shuffledPhrases] = useState(() => shuffleArray(PHRASES))
  const opacity = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [opacity])

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % shuffledPhrases.length)
    }, 1400)
    return () => clearInterval(interval)
  }, [shuffledPhrases.length])

  return (
    <View style={[styles.wrap, style]}>
      <Animated.Text
        style={[styles.text, { color: tokens.text2, fontFamily: fontFamily.bodyMedium, opacity }]}
      >
        {shuffledPhrases[phraseIndex]}
      </Animated.Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  text: {
    fontSize: 13,
  },
})
