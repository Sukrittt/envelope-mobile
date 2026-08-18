import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { fontFamily } from '@/src/theme/fonts'

/** Full-bleed story-card shell: solid accent background, big number, supporting copy. */
export function WrappedCard({
  color,
  onColor,
  eyebrow,
  children,
  style,
}: {
  color: string
  onColor: string
  eyebrow?: string
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[styles.card, { backgroundColor: color }, style]}>
      {eyebrow && (
        <Text style={[styles.eyebrow, { color: onColor, fontFamily: fontFamily.bodyBold }]}>{eyebrow}</Text>
      )}
      <View style={styles.body}>{children}</View>
    </View>
  )
}

export function WrappedBigNumber({ value, onColor }: { value: string; onColor: string }) {
  return (
    <Text style={[styles.bigNumber, { color: onColor, fontFamily: fontFamily.displayBold }]} numberOfLines={2} adjustsFontSizeToFit>
      {value}
    </Text>
  )
}

export function WrappedCaption({ value, onColor }: { value: string; onColor: string }) {
  return (
    <Text style={[styles.caption, { color: onColor, fontFamily: fontFamily.bodySemiBold }]}>{value}</Text>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 24,
    padding: 28,
    justifyContent: 'center',
  },
  eyebrow: {
    position: 'absolute',
    top: 28,
    left: 28,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.85,
  },
  body: {
    gap: 14,
  },
  bigNumber: {
    fontSize: 46,
    lineHeight: 52,
  },
  caption: {
    fontSize: 17,
    lineHeight: 24,
    opacity: 0.92,
  },
})
