import { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, Animated, Easing } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Reanimated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated'
import LottieView from 'lottie-react-native'
import { useAudioPlayer } from 'expo-audio'
import * as Haptics from 'expo-haptics'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { useBudgets } from '@/src/hooks/useBudgets'
import { useCategories } from '@/src/hooks/useCategories'
import { useDeleteExpense, useExpenses } from '@/src/hooks/useExpenses'
import { useGroups } from '@/src/hooks/useGroups'
import { computeEnvelopeState, currentMonthKey } from '@/src/lib/envelope'
import { remove as removePendingExpense } from '@/src/lib/pendingExpenses'
import { categoryEmoji, splitEmoji } from '@/src/lib/emoji'
import { formatDateTimeLong } from '@/src/lib/format'
import { AmountText } from '@/src/components/ui/AmountText'
import { Button } from '@/src/components/ui/Button'
import { ProgressBar, FILL_DELAY, FILL_DURATION } from '@/src/components/envelope/ProgressBar'
import { LOG_EXPENSE_PATH } from '@/src/components/nav/FloatingNav'

/** The animation is a full badge — gradient disc, tick, glow — so it stands in
 *  for the icon *and* its container. Sized to be the screen's clear focal point. */
const TICK = 200
/** The tick itself lands ~700ms in; the rest of the 3s clip is the glow settling.
 *  The readout starts after the tick so nothing competes with it. */
const STAGGER = { amount: 520, detail: 640, stamp: 760, actions: 900 }
/** The receipt lands first and is allowed to be the whole screen for a beat;
 *  only then does the column glide up and the envelope charge itself. Exported
 *  so the test waits on the same number rather than a guessed one. */
export const ENVELOPE_DELAY = 1500

function str(v: string | string[] | undefined): string {
  return typeof v === 'string' ? v : ''
}

/**
 * Post-log confirmation. Reached only by a successful expense *add*, via
 * `router.replace` from log-expense — replace rather than push so Done lands on
 * home with no spent entry screen behind it. Editing an expense keeps the inline
 * CheckIcon on its own button; "Added ₹450" is the wrong sentence for an edit.
 *
 * A route rather than an overlay inside log-expense because the floating nav is a
 * sibling above the whole root Stack: `navStateFor` reports any non-tab pathname
 * as hidden, so the nav fades itself out here without new plumbing.
 *
 * Layout is a bare centered stack — tick, amount, then plain text lines that
 * shrink as they descend. No card, no chip: a payment receipt reads as one
 * column, and a bordered container around three rows was the thing that made
 * this screen look like a generic form instead of a moment.
 *
 * Revealed in two phases. The receipt lines land alone, then the envelope block
 * mounts below them — the group above is a single Reanimated.View with a
 * `layout` transition, so the recentre a taller column forces animates as a
 * glide instead of a jump. No measured heights.
 */
export default function ExpenseAddedScreen() {
  const { tokens, space, type, motion } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const params = useLocalSearchParams()

  const id = str(params.id)
  const clientId = str(params.clientId)
  // Set by log-expense when useAddExpense caught a transport failure and
  // queued this create instead of a real POST — no server row exists yet, so
  // the envelope phase (computed from server data) and the id-addressed Undo
  // both stand down in favor of the offline-specific versions below.
  const pending = str(params.pending) === '1'
  const timestamp = str(params.timestamp)
  const item = str(params.item)
  const category = str(params.category)
  const date = str(params.date)
  const notes = str(params.notes)
  const paymentMethod = str(params.paymentMethod)
  const amount = Number(str(params.amount)) || 0
  // Older servers return no timestamp on POST, which left the stamp line blank.
  // log-expense sends the moment it navigated as a fallback; it is only ever
  // displayed — Undo still addresses the row by `timestamp`, empty or not.
  const stamp = timestamp || str(params.loggedAt)

  const budgetsQ = useBudgets()
  const expensesQ = useExpenses()
  const categoriesQ = useCategories()
  const groupsQ = useGroups()
  const deleteExpense = useDeleteExpense()

  const [undoError, setUndoError] = useState('')
  const [playTick, setPlayTick] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setPlayTick(true), 500)
    return () => clearTimeout(t)
  }, [])

  // ponytail: no sound/haptics preference — the app has none today. Clone
  // src/context/PrivacyContext.tsx if one is ever wanted.
  // Logging an expense is the only action that chimes — every other success CTA
  // is the silent inline CheckIcon, so the sound stays the app's one verb.
  const chime = useAudioPlayer(require('@/assets/sounds/success.m4a'))
  useEffect(() => {
    // Chime and haptic together at mount, landing with the tick's first stroke.
    chime.play()
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
  }, [chime])

  const envelope = useMemo(() => {
    const state = computeEnvelopeState(
      budgetsQ.data ?? [],
      expensesQ.data ?? [],
      currentMonthKey(),
      categoriesQ.data ?? [],
      groupsQ.data ?? [],
    )
    return state.envelopes.find((e) => e.category === category)
  }, [budgetsQ.data, expensesQ.data, categoriesQ.data, groupsQ.data, category])

  // The refetch this mutation triggered may not have landed yet — if the new row
  // isn't in the list, the envelope hasn't been charged for it. Subtract by hand so
  // the number is right on first paint instead of ticking down mid-animation.
  const counted = (expensesQ.data ?? []).some((e) => e.timestamp === timestamp)
  const spent = (envelope?.spent ?? 0) + (counted ? 0 : amount)
  const left = (envelope?.available ?? 0) - (counted ? 0 : amount)
  const funded = (envelope?.assigned ?? 0) + (envelope?.rolledOver ?? 0)
  // Nothing to show for a category with no money in it this month — and
  // nothing to show at all offline, since the envelope balance is computed
  // from server data this screen doesn't have yet.
  const showEnvelope = !pending && envelope != null && funded > 0
  const spentPct = funded > 0 ? Math.min(100, (spent / funded) * 100) : 0
  // Where the bar stood before this expense — the bar tweens from here to
  // spentPct, so the fill *is* the charge.
  const prevPct = funded > 0 ? Math.min(100, ((spent - amount) / funded) * 100) : 0

  const categoryName = splitEmoji(category).text
  const categoryLabel = category ? `${categoryEmoji(category, envelope?.group)} ${categoryName}` : ''
  // One line, not two: when an item is named after its category ("Groceries" in
  // "🛒 Groceries") the two lines read as a duplicate.
  const sameAsCategory = item.trim().toLowerCase() === categoryName.trim().toLowerCase()
  const detail = item !== '' && categoryLabel !== '' && !sameAsCategory
    ? `${item} · ${categoryLabel}`
    : categoryLabel || item

  const [revealEnvelope, setRevealEnvelope] = useState(false)
  useEffect(() => {
    // Keyed off showEnvelope, not mount: the queries it reads may still be in
    // flight, and the block should get its beat whenever it becomes real.
    if (!showEnvelope) return
    const t = setTimeout(() => setRevealEnvelope(true), ENVELOPE_DELAY)
    return () => clearTimeout(t)
  }, [showEnvelope])

  // The "% used" figure counts up in lockstep with the bar fill: shown
  // instantly at the pre-expense percentage, then tweened to the post-expense
  // one on the same delay/duration/easing as ProgressBar's own fill animation.
  const [pctDisplay, setPctDisplay] = useState(Math.round(prevPct))
  useEffect(() => {
    if (!revealEnvelope) return
    const anim = new Animated.Value(prevPct)
    const listenerId = anim.addListener(({ value }) => setPctDisplay(Math.round(value)))
    Animated.timing(anim, {
      toValue: spentPct,
      duration: FILL_DURATION,
      delay: FILL_DELAY,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start()
    return () => {
      anim.stopAnimation()
      anim.removeListener(listenerId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealEnvelope])

  const [undoingPending, setUndoingPending] = useState(false)

  function handleUndo() {
    setUndoError('')
    // A queued create has no server row to DELETE — dropping it from the
    // local queue is the entire undo.
    if (pending) {
      if (undoingPending) return
      setUndoingPending(true)
      removePendingExpense(clientId).then(() =>
        router.replace({
          pathname: LOG_EXPENSE_PATH,
          params: { item, amountInr: String(amount), category, date, notes, paymentMethod },
        }),
      )
      return
    }
    if (deleteExpense.isPending) return
    deleteExpense.mutate(
      { id: id || undefined, timestamp, item, amountInr: amount },
      {
        onSuccess: () =>
          router.replace({
            pathname: LOG_EXPENSE_PATH,
            params: { item, amountInr: String(amount), category, date, notes, paymentMethod },
          }),
        onError: () => setUndoError('Could not undo. The expense is still saved.'),
      },
    )
  }

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg, paddingHorizontal: space.lg }]}>
      <View style={styles.body}>
        <Reanimated.View style={styles.receipt} layout={LinearTransition.duration(motion.slow)}>
          {/* Wrapper carries the spacing so the animation's own style stays
              purely its box. Mounts 500ms in so the tick lands after a beat
              rather than on first paint. */}
          <View style={{ marginBottom: space.xxl }}>
            {playTick && (
              <LottieView
                source={require('@/assets/animations/success-tick.lottie')}
                style={styles.tick}
                autoPlay
                loop={false}
              />
            )}
          </View>

          <Reanimated.View
            entering={FadeIn.delay(STAGGER.amount).duration(350)}
            style={[styles.addedRow, { gap: space.sm }]}
          >
            <Text
              style={[styles.line, { color: tokens.text, fontFamily: fontFamily.displayBold, fontSize: type.heading }]}
            >
              Added
            </Text>
            <AmountText value={amount} size={type.display} weight="displayBold" animate />
          </Reanimated.View>

          {detail !== '' && (
            <Reanimated.Text
              entering={FadeIn.delay(STAGGER.detail).duration(350)}
              numberOfLines={1}
              style={[
                styles.line,
                {
                  color: tokens.text,
                  fontFamily: fontFamily.bodySemiBold,
                  fontSize: type.bodyLg,
                  marginTop: space.md,
                },
              ]}
            >
              {detail}
            </Reanimated.Text>
          )}

          {stamp !== '' && (
            <Reanimated.Text
              entering={FadeIn.delay(STAGGER.stamp).duration(350)}
              style={[
                styles.line,
                {
                  color: tokens.text3,
                  fontFamily: fontFamily.bodyMedium,
                  fontSize: type.caption,
                  marginTop: space.xs,
                },
              ]}
            >
              {formatDateTimeLong(stamp)}
            </Reanimated.Text>
          )}
        </Reanimated.View>

        {pending && (
          <Reanimated.Text
            entering={FadeIn.delay(STAGGER.stamp).duration(350)}
            style={[
              styles.line,
              { color: tokens.text3, fontFamily: fontFamily.bodyMedium, fontSize: type.body, marginTop: space.xl },
            ]}
          >
            Logged offline. It&apos;ll sync when you&apos;re back online.
          </Reanimated.Text>
        )}

        {revealEnvelope && (
          <Reanimated.View
            entering={FadeInDown.duration(motion.slow)}
            style={[styles.envelope, { marginTop: space.xl, gap: space.sm }]}
          >
            <View style={[styles.leftRow, { gap: space.xs, marginTop: space.xs }]}>
              <AmountText
                value={left}
                size={type.body}
                weight="bodySemiBold"
                color={left < 0 ? tokens.coral : tokens.text2}
              />
              <Text
                style={[styles.line, { color: tokens.text3, fontFamily: fontFamily.bodyMedium, fontSize: type.body }]}
              >
                {`left in ${categoryName} (${pctDisplay}% used)`}
              </Text>
            </View>
            <ProgressBar pct={spentPct} from={prevPct} />
          </Reanimated.View>
        )}
      </View>

      <Reanimated.View
        entering={FadeIn.delay(STAGGER.actions).duration(350)}
        style={[styles.footer, { paddingBottom: insets.bottom + space.xl, gap: space.sm }]}
      >
        {undoError !== '' && (
          <Text style={[styles.line, { color: tokens.coral, fontFamily: fontFamily.bodySemiBold, fontSize: type.caption }]}>
            {undoError}
          </Text>
        )}
        <Button label="Done" onPress={() => router.replace('/(tabs)')} />
        {/* Without an id we can only address the row by a timestamp/item/amount
            triple — and no id means an older server, whose delete may match the
            wrong row. Better no Undo than the wrong expense deleted. A pending
            (offline-queued) row has no id yet but is always safely addressable
            by its own client_id, so it gets Undo too. */}
        {(id !== '' || pending) && (
          <Button
            label={deleteExpense.isPending || undoingPending ? 'Undoing…' : 'Undo'}
            variant="ghost"
            disabled={deleteExpense.isPending || undoingPending}
            onPress={handleUndo}
          />
        )}
      </Reanimated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tick: { width: TICK, height: TICK },
  receipt: { alignItems: 'center' },
  addedRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  envelope: { alignSelf: 'center', width: '100%', maxWidth: 260 },
  leftRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  line: { textAlign: 'center' },
  footer: {},
})
