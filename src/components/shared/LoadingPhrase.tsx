import { useEffect, useState } from 'react'
import { View, StyleSheet, type TextStyle, type StyleProp } from 'react-native'
import Animated, { SlideInDown, SlideOutUp } from 'react-native-reanimated'

/** Cycles through `phrases`, each one sliding up and out as the next slides up from below. */
export function LoadingPhrase({ phrases, color, style }: { phrases: string[]; color: string; style?: StyleProp<TextStyle> }) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % phrases.length), 1800)
    return () => clearInterval(id)
  }, [phrases])
  return (
    <View style={styles.wrap}>
      <Animated.Text key={index} entering={SlideInDown.duration(450)} exiting={SlideOutUp.duration(450)} style={[styles.text, { color }, style]}>
        {phrases[index]}
      </Animated.Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { height: 22, overflow: 'hidden', justifyContent: 'center' },
  text: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, textAlignVertical: 'center' },
})
