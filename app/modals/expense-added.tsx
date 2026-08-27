import { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Reanimated, { FadeIn } from 'react-native-reanimated'
import { DotLottie } from '@lottiefiles/dotlottie-react-native'
import { useAudioPlayer } from 'expo-audio'
import * as Haptics from 'expo-haptics'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { useBudgets } from '@/src/hooks/useBudgets'
import { useCategories } from '@/src/hooks/useCategories'
import { useDeleteExpense, useExpenses } from '@/src/hooks/useExpenses'
import { useGroups } from '@/src/hooks/useGroups'
import { computeEnvelopeState, currentMonthKey } from '@/src/lib/envelope'
import { categoryEmoji, splitEmoji } from '@/src/lib/emoji'
import { formatDateTimeLong } from '@/src/lib/format'
import { AmountText } from '@/src/components/ui/AmountText'
import { Button } from '@/src/components/ui/Button'
import { LOG_EXPENSE_PATH } from '@/src/components/nav/FloatingNav'

/** The animation is a full badge — gradient disc, tick, glow — so it stands in
 *  for the icon *and* its container. Sized to be the screen's clear focal point. */
const TICK = 200
/** The tick itself lands ~700ms in; the rest of the 3s clip is the glow settling.
 *  The readout starts after the tick so nothing competes with it. */
const STAGGER = { amount: 520, item: 640, meta: 760, actions: 900 }

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
 * shrink as they descend. No card, no chip, no progress bar: a payment receipt
 * reads as one column, and a bordered container around three rows was the thing
 * that made this screen look like a generic form instead of a moment.
 */
export default function ExpenseAddedScreen() {
  const { tokens, space, type } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const params = useLocalSearchParams()

  const id = str(params.id)
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
  const chime = useAudioPlayer(require('@/assets/sounds/success.wav'))
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
  const left = (envelope?.available ?? 0) - (counted ? 0 : amount)
  const funded = (envelope?.assigned ?? 0) + (envelope?.rolledOver ?? 0)
  // Nothing to show for a category with no money in it this month.
  const showEnvelope = envelope != null && funded > 0

  const categoryName = splitEmoji(category).text
  const categoryLabel = category ? `${categoryEmoji(category, envelope?.group)} ${categoryName}` : ''

  function handleUndo() {
    if (deleteExpense.isPending) return
    setUndoError('')
    deleteExpense.mutate(
      { id: id || undefined, timestamp, item, amountInr: amount },
      {
        onSuccess: () =>
          router.replace({
            pathname: LOG_EXPENSE_PATH,
            params: { item, amountInr: String(amount), category, date, notes, paymentMethod },
          }),
        onError: (e) => setUndoError(e instanceof Error ? e.message : 'Could not undo — the expense is still saved'),
      },
    )
  }

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg, paddingHorizontal: space.lg }]}>
      <View style={styles.body}>
        {/* Wrapper carries the spacing: DotLottie's `style` is a plain ViewStyle,
            not a StyleProp, so it takes no array. */}
        <View style={{ marginBottom: space.xxl }}>
          <DotLottie
            source={require('@/assets/animations/success-tick.lottie')}
            style={styles.tick}
            autoplay
            loop={false}
          />
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

        {item !== '' && (
          <Reanimated.Text
            entering={FadeIn.delay(STAGGER.item).duration(350)}
            numberOfLines={1}
            style={[
              styles.line,
              {
                color: tokens.text,
                fontFamily: fontFamily.bodySemiBold,
                fontSize: type.title,
                marginTop: space.md,
              },
            ]}
          >
            {item}
          </Reanimated.Text>
        )}

        <Reanimated.View entering={FadeIn.delay(STAGGER.meta).duration(350)} style={{ gap: space.xs }}>
          {categoryLabel !== '' && (
            <Text
              numberOfLines={1}
              style={[
                styles.line,
                {
                  color: tokens.text2,
                  fontFamily: fontFamily.bodyMedium,
                  fontSize: type.bodyLg,
                  marginTop: space.sm,
                },
              ]}
            >
              {categoryLabel}
            </Text>
          )}

          {stamp !== '' && (
            <Text
              style={[styles.line, { color: tokens.text3, fontFamily: fontFamily.bodyMedium, fontSize: type.caption }]}
            >
              {formatDateTimeLong(stamp)}
            </Text>
          )}

          {showEnvelope && (
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
                {`left in ${categoryName}`}
              </Text>
            </View>
          )}
        </Reanimated.View>
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
            wrong row. Better no Undo than the wrong expense deleted. */}
        {id !== '' && (
          <Button
            label={deleteExpense.isPending ? 'Undoing…' : 'Undo'}
            variant="ghost"
            disabled={deleteExpense.isPending}
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
  addedRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  leftRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  line: { textAlign: 'center' },
  footer: {},
})
