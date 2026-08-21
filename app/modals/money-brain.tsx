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
  Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ArrowLeft, ArrowUp, Clock, SquarePen } from 'lucide-react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { usePrivacy } from '@/src/context/PrivacyContext'
import { fontFamily } from '@/src/theme/fonts'
import { useBudgets } from '@/src/hooks/useBudgets'
import { useExpenses } from '@/src/hooks/useExpenses'
import { useCategories } from '@/src/hooks/useCategories'
import { useGroups } from '@/src/hooks/useGroups'
import { useMoneyBrief } from '@/src/hooks/useMoneyBrief'
import { useChatSessions } from '@/src/hooks/useChatSessions'
import { computeEnvelopeState, currentMonthKey } from '@/src/lib/envelope'
import { formatCurrency } from '@/src/lib/format'
import { ProgressBar } from '@/src/components/envelope/ProgressBar'
import { LoadingCaption } from '@/src/components/shared/LoadingCaption'
import { Icon } from '@/src/components/shared/Icon'
import { InsightCard } from '@/src/components/brain/InsightCard'
import { ChatHistoryList } from '@/src/components/brain/ChatHistoryList'
import { streamChat, getChatSession, type ChatMessage } from '@/src/api/ai'

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

  const [view, setView] = useState<'chat' | 'history'>('chat')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<ScrollView>(null)

  const historyQuery = useChatSessions(view === 'history')

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
      sessionId,
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
      .then((resolvedSessionId) => setSessionId(resolvedSessionId))
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

  function startNewChat() {
    abortRef.current?.abort()
    setSending(false)
    setMessages([])
    setSessionId(null)
    setInput('')
    setView('chat')
  }

  async function openSession(id: string) {
    try {
      const detail = await getChatSession(id)
      setMessages(detail.messages)
      setSessionId(detail.id)
      setView('chat')
    } catch {
      Alert.alert('Could not load chat', 'Check your connection and try again.')
    }
  }

  const lastMessage = messages[messages.length - 1]
  const awaitingFirstDelta = sending && lastMessage?.role === 'model' && lastMessage.text === ''

  if (view === 'history') {
    return (
      <View style={[styles.container, { backgroundColor: tokens.bg }]}>
        <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
          <Pressable
            onPress={() => setView('chat')}
            hitSlop={12}
            style={[styles.iconButton, { backgroundColor: tokens.card, borderColor: tokens.border }]}
          >
            <Icon icon={ArrowLeft} size={18} color={tokens.text} />
          </Pressable>
          <Text
            style={[styles.title, { color: tokens.text, fontFamily: fontFamily.displaySemiBold, marginLeft: 12 }]}
          >
            Chat history
          </Text>
        </View>
        <ChatHistoryList sessions={historyQuery.data} loading={historyQuery.isLoading} onSelect={openSession} />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: tokens.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View style={styles.headerLeft}>
          <View>
            <Text style={[styles.title, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
              Money brain
            </Text>
            <Text style={[styles.subtitle, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
              {brief ? `Reading ${brief.meta.txnCountThisMonth} transactions this month` : 'Reading your budget…'}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => setView('history')}
            hitSlop={10}
            style={[styles.iconButton, { backgroundColor: tokens.card, borderColor: tokens.border }]}
          >
            <Icon icon={Clock} size={16} color={tokens.text} />
          </Pressable>
          <Pressable
            onPress={startNewChat}
            hitSlop={10}
            style={[styles.iconButton, { backgroundColor: tokens.card, borderColor: tokens.border }]}
          >
            <Icon icon={SquarePen} size={16} color={tokens.text} />
          </Pressable>
          <Pressable onPress={() => router.push('/(tabs)')} hitSlop={12}>
            <Text style={[styles.home, { color: tokens.gold, fontFamily: fontFamily.bodySemiBold }]}>Go Home</Text>
          </Pressable>
        </View>
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
            {messages.map((m, i) => {
              if (!m.text) return null // empty placeholder while streaming hasn't started — LoadingCaption covers it below
              return (
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
              )
            })}
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
          <Icon icon={ArrowUp} size={18} color={tokens.onAccent} />
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
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18 },
  subtitle: { fontSize: 12, marginTop: 2 },
  home: { fontSize: 14 },
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
