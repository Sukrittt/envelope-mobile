import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Sparkles } from 'lucide-react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { Icon } from '@/src/components/shared/Icon'
import { Button } from '@/src/components/ui/Button'
import { PopIn } from '@/src/components/shared/PopIn'
import { nextAllowanceReset } from '@/src/lib/aiAllowance'

/**
 * Shown when the server refuses an AI request because this month's allowance
 * is spent. Opened by the root layout the moment a chat or bill scan is
 * refused (see onAiAllowanceExceeded). It says when it comes back and, just as
 * importantly, that nothing else is affected — budgeting keeps working.
 */
export default function AiAllowanceScreen() {
  const { tokens, radius, space, type } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const resetsOn = nextAllowanceReset().toLocaleDateString(undefined, { day: 'numeric', month: 'long' })

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: space.lg,
          paddingTop: space.xl,
          paddingBottom: space.lg,
          gap: space.lg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <PopIn play delay={0}>
          <View style={[styles.badge, { backgroundColor: tokens.accentSoft }]}>
            <Icon icon={Sparkles} size={28} color={tokens.accentInk} strokeWidth={2.2} />
          </View>
        </PopIn>

        <PopIn play delay={80} style={{ gap: space.xs, alignItems: 'center' }}>
          <Text style={{ color: tokens.text, fontFamily: fontFamily.displaySemiBold, fontSize: type.title, textAlign: 'center' }}>
            {"You've used this month's AI"}
          </Text>
          <Text style={{ color: tokens.text2, fontFamily: fontFamily.bodySemiBold, fontSize: type.caption, textAlign: 'center', lineHeight: 20 }}>
            {`Money Brain, bill scanning and your daily brief take a break until ${resetsOn}.`}
          </Text>
        </PopIn>

        <PopIn play delay={160} style={{ width: '100%' }}>
          <View style={[styles.card, { backgroundColor: tokens.cardSolid, borderColor: tokens.border, borderRadius: radius.md, padding: space.md, gap: space.sm }]}>
            <Text style={{ color: tokens.text, fontFamily: fontFamily.bodyExtraBold, fontSize: type.caption }}>
              Everything else works as normal
            </Text>
            <Text style={{ color: tokens.text2, fontFamily: fontFamily.bodyMedium, fontSize: type.caption, lineHeight: 20 }}>
              Log expenses by hand, manage your envelopes, and see your reports. Your allowance refreshes on its own at the start of the month.
            </Text>
          </View>
        </PopIn>
      </ScrollView>

      <View style={{ padding: space.lg, paddingTop: space.sm, paddingBottom: insets.bottom + space.lg }}>
        <Button label="Got it" onPress={() => router.back()} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: { width: 60, height: 60, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1 },
})
