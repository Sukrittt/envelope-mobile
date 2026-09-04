import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Reanimated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import LottieView from 'lottie-react-native'
import { useAudioPlayer } from 'expo-audio'
import * as Haptics from 'expo-haptics'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { useBudgets } from '@/src/hooks/useBudgets'
import { useCategories } from '@/src/hooks/useCategories'
import { useDeleteExpense, useExpenses } from '@/src/hooks/useExpenses'
import { useGroups } from '@/src/hooks/useGroups'
import { computeEnvelopeState, currentMonthKey, daysLeftInMonth } from '@/src/lib/envelope'
import { remove as removePendingExpense } from '@/src/lib/pendingExpenses'
import { categoryEmoji, splitEmoji } from '@/src/lib/emoji'
import { formatDateTimeLong } from '@/src/lib/format'
import { AmountText } from '@/src/components/ui/AmountText'
import { Button } from '@/src/components/ui/Button'
import { DeltaBar, DELTA_DELAY } from '@/src/components/envelope/DeltaBar'
import { fillColor, fillSoftColor } from '@/src/components/envelope/ProgressBar'
import { LOG_EXPENSE_PATH } from '@/src/components/nav/FloatingNav'

/** Reveal stagger, in ms from mount. The tick (Lottie) runs its own internal
 *  timing and needs no entry here. `cardFooter` (the days-left/pace row) is
 *  deliberately last, after the delta bar and its `+₹X` tag have landed
 *  (DeltaBar's own DELTA_DELAY/tag beats) — it reads as the final payoff, not
 *  part of the card's first paint. */
const STAGGER = { headline: 220, detail: 300, card: 380, footer: 560, cardFooter: 1500 }
/** Bundled rather than remote (contrast expense-failed's ERROR_LOTTIE): this
 *  is the one animation every successful add plays, so it can't depend on a
 *  network fetch landing in time. */
const TICK = 200

function str(v: string | string[] | undefined): string {
  return typeof v === 'string' ? v : ''
}

/**
 * Post-log confirmation. Reached only by a successful expense *add*, via
 * `router.replace` from log-expense once the nav circle's own save animation
 * finishes — replace rather than push so Done lands on home with no spent
 * entry screen behind it. Editing an expense keeps the inline CheckIcon on
 * its own button; "Added ₹450" is the wrong sentence for an edit.
 *
 * A route rather than an overlay inside log-expense because the floating nav is a
 * sibling above the whole root Stack: `navStateFor` reports any non-tab pathname
 * as hidden, so the nav fades itself out here without new plumbing.
 *
 * One tight vertical column, no floating clusters: tick, "Added ₹X", the item
 * name, then the budget card — the actual payoff, promoted above the fold
 * instead of held back. The card's `DeltaBar` grows to the *pre*-expense
 * position, pins a ghost marker there, then snaps in the delta segment; the
 * "left" figure counts down from the pre-expense value on the same beat
 * (`DELTA_DELAY`). A days-left/pace row reveals last (`STAGGER.cardFooter`),
 * after the delta and its `+₹X` tag have landed — the final payoff, not part
 * of the card's first paint.
 */
export default function ExpenseAddedScreen() {
  const { tokens, space, type, radius } = useTheme()
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
  // Where the bar stood before this expense — the DeltaBar tweens its base
  // fill to here, then snaps in the delta on top.
  const prevPct = funded > 0 ? Math.min(100, ((spent - amount) / funded) * 100) : 0
  // `left` is already the post-expense figure (see the hand-charge comment
  // above); adding the amount back gives the pre-expense one the counter
  // starts from.
  const preLeft = left + amount
  // Days left in the month at ₹0 on the last day, matching Home's own
  // "Less than 24 hrs" floor rather than dividing by zero.
  const daysLeft = daysLeftInMonth()
  const perDay = daysLeft > 0 ? Math.round(left / daysLeft) : left

  // Card only ever mounts once `showEnvelope` is true, so the query data — and
  // therefore `preLeft` — is already resolved on the AmountText's first render;
  // seeding state from it directly (rather than a hardcoded 0 fixed up in an
  // effect) skips a spurious 0 -> preLeft roll that would otherwise eat the
  // "counts down" moment meant for preLeft -> left.
  const [shownLeft, setShownLeft] = useState(preLeft)
  const seededRef = useRef(false)
  useEffect(() => {
    if (!showEnvelope || seededRef.current) return
    seededRef.current = true
    setShownLeft(preLeft)
    const t = setTimeout(() => setShownLeft(left), DELTA_DELAY)
    return () => clearTimeout(t)
    // Deliberately keyed on showEnvelope alone: once the card first shows,
    // the countdown should run exactly once on its own beat (capturing
    // whatever preLeft/left were at that moment), not restart every time a
    // background refetch nudges `left` by a rupee.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEnvelope])

  // Category already shows in the budget card below (pill + dot) — repeating
  // it here as "item · category" read as a duplicate, so the line under the
  // headline is the item name alone.
  const categoryName = splitEmoji(category).text
  const categoryLabel = category ? `${categoryEmoji(category, envelope?.group)} ${categoryName}` : ''
  const subtitle = item || categoryLabel

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
        <View style={styles.receipt}>
          <LottieView
            source={require('@/assets/animations/success-tick.lottie')}
            style={styles.lottie}
            autoPlay
            loop={false}
          />

          <Reanimated.View entering={FadeInDown.delay(STAGGER.headline).duration(420)} style={{ marginTop: space.xl }}>
            <View style={[styles.headlineRow, { gap: space.xs }]}>
              <Text
                style={[
                  styles.line,
                  { color: tokens.text, fontFamily: fontFamily.displayBold, fontSize: type.display },
                ]}
              >
                Added
              </Text>
              <AmountText value={amount} size={type.display} weight="displayBold" animate />
            </View>
          </Reanimated.View>

          {subtitle !== '' && (
            <Reanimated.Text
              entering={FadeInDown.delay(STAGGER.detail).duration(420)}
              numberOfLines={1}
              style={[
                styles.line,
                { color: tokens.text2, fontFamily: fontFamily.bodyMedium, fontSize: type.bodyLg, marginTop: space.sm },
              ]}
            >
              {subtitle}
            </Reanimated.Text>
          )}
        </View>

        {pending && (
          <Reanimated.Text
            entering={FadeInDown.delay(STAGGER.card).duration(460)}
            style={[
              styles.line,
              { color: tokens.text3, fontFamily: fontFamily.bodyMedium, fontSize: type.body, marginTop: space.xl },
            ]}
          >
            Logged offline. It&apos;ll sync when you&apos;re back online.
          </Reanimated.Text>
        )}

        {showEnvelope && (
          <Reanimated.View
            entering={FadeInDown.delay(STAGGER.card).duration(460)}
            style={[
              styles.card,
              { backgroundColor: tokens.cardSolid, borderRadius: radius.lg, padding: space.lg + space.xs, marginTop: space.xxl },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <View style={[styles.categoryRow, { gap: space.xs }]}>
                <View style={[styles.categoryDot, { backgroundColor: fillColor(spentPct, tokens) }]} />
                <Text
                  numberOfLines={1}
                  style={[styles.line, { color: tokens.text, fontFamily: fontFamily.bodySemiBold, fontSize: type.caption }]}
                >
                  {categoryName}
                </Text>
              </View>
              <View
                style={[
                  styles.usedPill,
                  { backgroundColor: fillSoftColor(spentPct, tokens), borderRadius: radius.full, paddingHorizontal: space.sm },
                ]}
              >
                <Text
                  style={{ color: fillColor(spentPct, tokens), fontFamily: fontFamily.bodySemiBold, fontSize: type.caption }}
                >
                  {`${Math.round(spentPct)}% used`}
                </Text>
              </View>
            </View>

            <View style={[styles.leftRow, { gap: space.xs, marginTop: space.md }]}>
              <AmountText value={shownLeft} size={type.title} weight="displayBold" animate />
              <Text style={[styles.line, { color: tokens.text2, fontFamily: fontFamily.bodyMedium, fontSize: type.body }]}>
                {`left of ₹${Math.round(funded).toLocaleString('en-IN')}`}
              </Text>
            </View>

            <View style={{ marginTop: space.lg }}>
              <DeltaBar from={prevPct} to={spentPct} amount={amount} />
            </View>

            <Reanimated.View
              entering={FadeIn.delay(STAGGER.cardFooter).duration(420)}
              style={[
                styles.cardFooterRow,
                { borderTopColor: tokens.border, marginTop: space.xl + space.sm, paddingTop: space.md },
              ]}
            >
              <Text style={[styles.line, { color: tokens.text3, fontFamily: fontFamily.bodyMedium, fontSize: type.caption }]}>
                {daysLeft === 0 ? 'Less than 24 hrs' : `${daysLeft} days left`}
              </Text>
              <Text style={[styles.line, { color: tokens.text, fontFamily: fontFamily.bodySemiBold, fontSize: type.caption }]}>
                {`₹${perDay.toLocaleString('en-IN')}/day to stay on track`}
              </Text>
            </Reanimated.View>
          </Reanimated.View>
        )}
      </View>

      <Reanimated.View
        entering={FadeInDown.delay(STAGGER.footer).duration(440)}
        style={[styles.footer, { paddingBottom: insets.bottom + space.xl, gap: space.md }]}
      >
        {undoError !== '' && (
          <Text style={[styles.line, { color: tokens.coral, fontFamily: fontFamily.bodySemiBold, fontSize: type.caption }]}>
            {undoError}
          </Text>
        )}
        <View style={[styles.buttonRow, { gap: space.md }]}>
          {/* Without an id we can only address the row by a timestamp/item/amount
              triple — and no id means an older server, whose delete may match the
              wrong row. Better no Undo than the wrong expense deleted. A pending
              (offline-queued) row has no id yet but is always safely addressable
              by its own client_id, so it gets Undo too. */}
          {(id !== '' || pending) && (
            <Button
              label={deleteExpense.isPending || undoingPending ? 'Undoing…' : 'Undo'}
              variant="secondary"
              disabled={deleteExpense.isPending || undoingPending}
              onPress={handleUndo}
              style={styles.undoButton}
            />
          )}
          <Button label="Done" onPress={() => router.replace('/(tabs)')} style={styles.doneButton} />
        </View>
        {stamp !== '' && (
          <Text
            style={[
              styles.line,
              { color: tokens.text3, fontFamily: fontFamily.bodyMedium, fontSize: type.caption, textAlign: 'center' },
            ]}
          >
            {formatDateTimeLong(stamp)}
          </Text>
        )}
      </Reanimated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  receipt: { alignItems: 'center' },
  headlineRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  lottie: { width: TICK, height: TICK },
  line: { textAlign: 'center' },
  card: { alignSelf: 'stretch' },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoryRow: { flexDirection: 'row', alignItems: 'center' },
  categoryDot: { width: 8, height: 8, borderRadius: 4 },
  usedPill: { paddingVertical: 3 },
  leftRow: { flexDirection: 'row', alignItems: 'baseline' },
  cardFooterRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth },
  footer: {},
  buttonRow: { flexDirection: 'row', alignItems: 'center' },
  undoButton: { flexBasis: 132, flexGrow: 0, height: 58 },
  doneButton: { flex: 1, height: 58 },
})
