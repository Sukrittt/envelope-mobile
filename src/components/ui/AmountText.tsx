import { useEffect, useRef } from 'react'
import { View, Text, Animated, Easing, StyleSheet, type TextStyle, type StyleProp } from 'react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { formatCurrency } from '@/src/lib/format'
import { usePrivacy } from '@/src/context/PrivacyContext'

/**
 * Every money display in the app. Owns three things that were previously
 * re-implemented per screen: INR formatting, the "hide amounts" mask (read
 * straight from PrivacyContext instead of being threaded down as a prop), and
 * tabular figures so digits do not jitter as a value changes.
 *
 * `animate` adds the odometer roll — only the digits that actually changed
 * scroll past their old value. Reserve it for hero numbers; a list of forty
 * rolling rows is noise.
 */
export function AmountText({
  value,
  size,
  color,
  weight = 'displaySemiBold',
  animate = false,
  style,
  rawText,
}: {
  value: number
  size: number
  color?: string
  weight?: keyof typeof fontFamily
  animate?: boolean
  style?: StyleProp<TextStyle>
  /** Pre-formatted text to show instead of `formatCurrency(value)` — e.g. a
   * numpad's in-progress string, where rounding through `value` would drop a
   * trailing "." or trailing zero the user just typed. Ignored when amounts
   * are hidden. */
  rawText?: string
}) {
  const { tokens } = useTheme()
  const { hideAmounts } = usePrivacy()
  const text = !hideAmounts && rawText !== undefined ? rawText : formatCurrency(value, hideAmounts)

  const textStyle: StyleProp<TextStyle> = [
    styles.base,
    { fontSize: size, color: color ?? tokens.text, fontFamily: fontFamily[weight] },
    style,
  ]

  // Masked values have no digits to roll, and a static render avoids animating
  // between "₹••••" and a real amount when the toggle flips.
  if (!animate || hideAmounts) {
    return (
      <Text style={textStyle} accessibilityLabel={text}>
        {text}
      </Text>
    )
  }

  return <Odometer text={text} size={size} textStyle={textStyle} />
}

function Odometer({ text, size, textStyle }: { text: string; size: number; textStyle: StyleProp<TextStyle> }) {
  // usePrevious: during this render prevRef still holds the previous string, so
  // each slot can diff old vs new before it is overwritten.
  const prevRef = useRef(text)
  const prev = prevRef.current
  useEffect(() => {
    prevRef.current = text
  }, [text])

  const rowHeight = Math.round(size * 1.2)
  const chars = text.split('')
  const prevChars = prev.split('')

  return (
    <View style={styles.row} accessibilityLabel={text} accessible>
      {chars.map((ch, i) => {
        // Align from the right so ₹900 -> ₹1,000 rolls the units column, not everything.
        const prevIndex = prevChars.length - (chars.length - i)
        return (
          <Digit
            key={i}
            oldChar={prevIndex >= 0 ? prevChars[prevIndex] : ''}
            newChar={ch}
            rowHeight={rowHeight}
            textStyle={textStyle}
          />
        )
      })}
    </View>
  )
}

function Digit({
  oldChar,
  newChar,
  rowHeight,
  textStyle,
}: {
  oldChar: string
  newChar: string
  rowHeight: number
  textStyle: StyleProp<TextStyle>
}) {
  const { motion } = useTheme()
  // Only roll between two digits. Pairing a structural char (₹, `,`, `-`)
  // with a digit or the other structural char — which right-aligned diffing
  // does whenever the string crosses a grouping boundary, e.g. "₹1,000" ->
  // "₹100" — stacks the wrong glyph until the roll finishes, flashing "," or
  // a stray digit where the symbol/leading digit should be.
  const isDigit = (c: string) => c >= '0' && c <= '9'
  const changed = oldChar !== '' && oldChar !== newChar && isDigit(oldChar) && isDigit(newChar)
  // RN core Animated rather than Reanimated: this is a plain translateY tween
  // with no gesture or worklet, and it keeps the primitive renderable under Jest.
  const translateY = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!changed) return
    translateY.setValue(0)
    Animated.timing(translateY, {
      toValue: -rowHeight,
      duration: motion.slow,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
    // Depend on both chars, not just newChar: right-aligned diffing means a
    // slot's newChar can repeat a value it held back when it wasn't
    // "changed" (e.g. index 1 is '1' in both "₹100" and "₹10"). With only
    // [newChar], React sees no dependency change and never starts the roll,
    // so the view stays frozen on oldChar forever — the "shows 00 not 10"
    // bug. oldChar must be in the deps so a fresh "changed" pair always fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oldChar, newChar])

  const charStyle = [textStyle, { height: rowHeight, lineHeight: rowHeight }]

  if (!changed) {
    return (
      <View style={{ height: rowHeight }}>
        <Text style={charStyle}>{newChar}</Text>
      </View>
    )
  }

  return (
    <View style={{ height: rowHeight, overflow: 'hidden' }}>
      <Animated.View style={{ transform: [{ translateY }] }}>
        <Text style={charStyle}>{oldChar}</Text>
        <Text style={charStyle}>{newChar}</Text>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  base: { fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
})
