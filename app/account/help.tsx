import { useState } from 'react'
import { View, Text, Pressable, ScrollView, Linking, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'

const REPO = 'Sukrittt/ynab-replacement'

const ENVELOPES_EXPLAINER =
  'Every rupee you add starts in Ready to Assign — unclaimed, waiting for a job. You move it into envelopes like Rent, Food or Football, and each envelope tracks what it has left to spend. Log an expense against an envelope and its balance drops; nothing else moves. Envelopes usually roll over: whatever is left at the end of the month carries into the next one instead of vanishing, so a light month builds a cushion for a heavy one. The only number worth watching is Ready to Assign — once it hits zero, every rupee has a job.'

function bugUrl(): string {
  const title = encodeURIComponent('Bug: ')
  const body = encodeURIComponent('**What happened**\n\n**Steps to reproduce**\n\n**Expected**\n\n**Device / OS**\n')
  return `https://github.com/${REPO}/issues/new?title=${title}&body=${body}&labels=bug`
}

function feedbackUrl(): string {
  const title = encodeURIComponent('Feature request: ')
  const body = encodeURIComponent('**What would this let you do?**\n\n**Why does it matter?**\n')
  return `https://github.com/${REPO}/issues/new?title=${title}&body=${body}&labels=enhancement`
}

export default function HelpScreen() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [explainerOpen, setExplainerOpen] = useState(false)

  return (
    <View style={[styles.container, { backgroundColor: tokens.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: tokens.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={[styles.backButton, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
          <Text style={[styles.backText, { color: tokens.text }]}>←</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>Help & feedback</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}>
        <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
          <Pressable onPress={() => setExplainerOpen((v) => !v)} style={styles.row}>
            <Text style={{ fontSize: 16 }}>📖</Text>
            <Text style={[styles.rowLabel, { flex: 1, marginLeft: 12, color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>
              How envelopes work
            </Text>
            <Text style={[styles.chevron, { color: tokens.text3 }]}>{explainerOpen ? '⌃' : '→'}</Text>
          </Pressable>
          {explainerOpen && (
            <Text style={[styles.explainer, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
              {ENVELOPES_EXPLAINER}
            </Text>
          )}
          <View style={[styles.divider, { backgroundColor: tokens.border }]} />
          <Pressable onPress={() => Linking.openURL(bugUrl())} style={styles.row}>
            <Text style={{ fontSize: 16 }}>🐛</Text>
            <Text style={[styles.rowLabel, { flex: 1, marginLeft: 12, color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>
              Report a bug
            </Text>
            <Text style={[styles.chevron, { color: tokens.text3 }]}>→</Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: tokens.border }]} />
          <Pressable onPress={() => Linking.openURL(feedbackUrl())} style={styles.row}>
            <Text style={{ fontSize: 16 }}>💬</Text>
            <Text style={[styles.rowLabel, { flex: 1, marginLeft: 12, color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>
              Send feedback
            </Text>
            <Text style={[styles.chevron, { color: tokens.text3 }]}>→</Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: tokens.border }]} />
          <Pressable onPress={() => Linking.openURL(`https://github.com/${REPO}`)} style={styles.row}>
            <Text style={{ fontSize: 16 }}>⭐</Text>
            <Text style={[styles.rowLabel, { flex: 1, marginLeft: 12, color: tokens.text, fontFamily: fontFamily.bodySemiBold }]}>
              Star the repo
            </Text>
            <Text style={[styles.chevron, { color: tokens.text3 }]}>→</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  backButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 15 },
  headerTitle: { fontSize: 19 },
  scrollContent: { padding: 16, gap: 12 },
  card: { borderWidth: 1, borderRadius: 20, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  rowLabel: { fontSize: 14 },
  chevron: { fontSize: 16 },
  divider: { height: StyleSheet.hairlineWidth },
  explainer: { fontSize: 13, lineHeight: 20, paddingHorizontal: 16, paddingBottom: 16 },
})
