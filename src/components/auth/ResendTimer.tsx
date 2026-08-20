import { useEffect, useState } from 'react'
import { Pressable, Text, StyleSheet } from 'react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'

const RESEND_SECONDS = 30

export function ResendTimer({ onResend }: { onResend: () => void }) {
  const { tokens } = useTheme()
  const [seconds, setSeconds] = useState(RESEND_SECONDS)

  useEffect(() => {
    if (seconds <= 0) return
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [seconds])

  const handlePress = () => {
    if (seconds > 0) return
    onResend()
    setSeconds(RESEND_SECONDS)
  }

  return (
    <Pressable onPress={handlePress} disabled={seconds > 0} hitSlop={8}>
      <Text style={[styles.text, { color: seconds > 0 ? tokens.text3 : tokens.gold, fontFamily: fontFamily.bodySemiBold }]}>
        {seconds > 0 ? `Resend code in ${seconds}s` : "Didn't get it? Resend now"}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  text: { fontSize: 13, marginTop: 14 },
})
