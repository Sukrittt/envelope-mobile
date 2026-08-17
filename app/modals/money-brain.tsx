import { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useTheme } from '@/src/theme/ThemeProvider'
import { usePrivacy } from '@/src/context/PrivacyContext'
import { fontFamily } from '@/src/theme/fonts'
import { useBudgets } from '@/src/hooks/useBudgets'
import { useExpenses } from '@/src/hooks/useExpenses'
import { useCategories } from '@/src/hooks/useCategories'
import { useGroups } from '@/src/hooks/useGroups'
import { useMoneyBrief } from '@/src/hooks/useMoneyBrief'
import { computeEnvelopeState, currentMonthKey } from '@/src/lib/envelope'
import { formatCurrency } from '@/src/lib/format'
import { ProgressBar } from '@/src/components/envelope/ProgressBar'
import { LoadingCaption } from '@/src/components/shared/LoadingCaption'
import { InsightCard } from '@/src/components/brain/InsightCard'
import { streamChat, type ChatMessage } from '@/src/api/ai'

export default function MoneyBrainModal() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { hideAmounts } = usePrivacy()

  const budgetsQ = useBudgets()
  const expensesQ = useExpenses()
  const categoriesQ = useCategories()
  const groupsQ = useGroups()
  const briefQ = useMoneyBrief()

  const month = currentMonthKey()
  const envelopeState = useMemo(
    () =>
      computeEnvelopeState(
        budgetsQ.data ?? [],
        expensesQ.data ?? [],
        month,
        categoriesQ.data ?? [],
        groupsQ.data ?? [],
      ),
    [budgetsQ.data, expensesQ.data, categoriesQ.data, groupsQ.data, month],
  )

  const spentPct =
    envelopeState.totalAssigned > 0
      ? Math.min(100, (envelopeState.totalSpent / envelopeState.totalAssigned) * 100)
      : envelopeState.totalSpent > 0
        ? 100
        : 0

  const brief = briefQ.data

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    const history = [...messages, { role: 'user' as const, text: trimmed }]
    setMessages([...history, { role: 'model', text: '' }])
    setInput('')
    setSending(true)

    const controller = new AbortController()
    abortRef.current = controller

    streamChat(
      history,
      (delta) => {
        setMessages((prev) => {
          const copy = [...prev]
          const last = copy[copy.length - 1]
          copy[copy.length - 1] = { ...last, text: last.text + delta }
          return copy
        })
      },
      controller.signal,
    )
      .catch((e) => {
        setMessages((prev) => {
          const copy = [...prev]
          copy[copy.length - 1] = {
            role: 'model',
            text: e instanceof Error ? e.message : 'Something went wrong. Try again.',
          }
          return copy
        })
      })
      .finally(() => setSending(false))
  }

  const lastMessage = messages[messages.length - 1]
  const awaitingFirstDelta = sending && lastMessage?.role === 'model' && lastMessage.text === ''

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: tokens.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.badge, { backgroundColor: tokens.goldSoft }]}>
            <Text style={{ fontSize: 18 }}>✨</Text>
          </View>
          <View>
            <Text style={[styles.title, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
              Money brain
            </Text>
            <Text style={[styles.subtitle, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
              {brief ? `Reading ${brief.meta.txnCountThisMonth} transactions this month` : 'Reading your budget…'}
            </Text>
          </View>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.close, { color: tokens.text2 }]}>✕</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
          <Text style={[styles.cardLabel, { color: tokens.text2 }]}>THIS MONTH SO FAR</Text>
          <Text style={[styles.cardValue, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
            {formatCurrency(envelopeState.totalSpent, hideAmounts)} of{' '}
            {formatCurrency(envelopeState.totalAssigned, hideAmounts)} assigned
          </Text>
          <View style={{ marginTop: 8 }}>
            <ProgressBar pct={spentPct} />
          </View>
          {briefQ.isLoading ? (
            <View style={{ marginTop: 12 }}>
              <LoadingCaption />
            </View>
          ) : briefQ.isError ? (
            <View style={styles.errorRow}>
              <Text style={{ color: tokens.coral, fontSize: 12, fontFamily: fontFamily.bodyMedium, flex: 1 }}>
                Couldn't load your money brief.
              </Text>
              <Pressable onPress={() => briefQ.refetch()}>
                <Text style={{ color: tokens.gold, fontSize: 12, fontFamily: fontFamily.bodySemiBold }}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={[styles.narrative, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
              {brief?.narrative}
            </Text>
          )}
        </View>

        {brief && (
          <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
            {brief.cards.map((c, i) => (
              <InsightCard
                key={i}
                icon={c.icon}
                title={c.title}
                subtitle={c.subtitle}
                valueLabel={c.valueLabel}
                amount={c.amount}
                tone={c.tone}
                hideAmounts={hideAmounts}
              />
            ))}
          </View>
        )}

        {brief && brief.questions.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={[styles.sectionLabel, { color: tokens.text3 }]}>ASK ANYTHING</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {brief.questions.map((q) => (
                <Pressable
                  key={q}
                  onPress={() => send(q)}
                  disabled={sending}
                  style={[styles.chip, { backgroundColor: tokens.pillBg, borderColor: tokens.border, opacity: sending ? 0.5 : 1 }]}
                >
                  <Text style={[styles.chipText, { color: tokens.text2, fontFamily: fontFamily.bodySemiBold }]}>
                    {q}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {messages.length > 0 && (
          <View style={{ gap: 10 }}>
            {messages.map((m, i) => (
              <View
                key={i}
                style={[
                  styles.bubble,
                  m.role === 'user'
                    ? { alignSelf: 'flex-end', backgroundColor: tokens.goldSoft }
                    : { alignSelf: 'flex-start', backgroundColor: tokens.card, borderColor: tokens.border, borderWidth: 1 },
                ]}
              >
                <Text style={{ color: tokens.text, fontSize: 14, fontFamily: fontFamily.bodyMedium }}>
                  {m.text}
                </Text>
              </View>
            ))}
            {awaitingFirstDelta && <LoadingCaption />}
          </View>
        )}
      </ScrollView>

      <View style={[styles.inputRow, { borderTopColor: tokens.border, paddingBottom: insets.bottom + 12 }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask about your money…"
          placeholderTextColor={tokens.text3}
          style={[styles.input, { backgroundColor: tokens.inputBg, borderColor: tokens.border, color: tokens.text, fontFamily: fontFamily.bodyMedium }]}
          onSubmitEditing={() => send(input)}
          editable={!sending}
        />
        <Pressable
          onPress={() => send(input)}
          disabled={sending || input.trim() === ''}
          style={[styles.sendButton, { backgroundColor: tokens.gold, opacity: sending || input.trim() === '' ? 0.5 : 1 }]}
        >
          <Text style={{ color: tokens.onAccent, fontSize: 16, fontFamily: fontFamily.bodyBold }}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18 },
  subtitle: { fontSize: 12, marginTop: 2 },
  close: { fontSize: 18 },
  body: { padding: 20, paddingTop: 4, gap: 16 },
  card: { padding: 18, borderRadius: 20, borderWidth: 1 },
  cardLabel: { fontSize: 10, letterSpacing: 0.6 },
  cardValue: { fontSize: 18, marginTop: 6 },
  narrative: { fontSize: 13, marginTop: 12, lineHeight: 19 },
  errorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 12 },
  sectionLabel: { fontSize: 11, letterSpacing: 0.6 },
  chipRow: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  chipText: { fontSize: 13 },
  bubble: { maxWidth: '85%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, borderWidth: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14 },
  sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
})
