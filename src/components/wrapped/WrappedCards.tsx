import { View, Text, StyleSheet } from 'react-native'
import Svg, { Rect } from 'react-native-svg'
import type { WrappedData } from '@/src/api/wrapped'
import { formatCurrency, formatDate } from '@/src/lib/format'
import { fontFamily } from '@/src/theme/fonts'
import { WrappedCard, WrappedBigNumber, WrappedCaption } from './WrappedCard'

interface CardProps {
  data: WrappedData
  color: string
  onColor: string
}

export function IntroCard({ data, color, onColor }: CardProps) {
  return (
    <WrappedCard color={color} onColor={onColor} eyebrow="🎁 Your Envelope Wrapped">
      <WrappedBigNumber value={`${data.range.daysTracked} days`} onColor={onColor} />
      <WrappedCaption
        value={`tracked from ${formatDate(data.range.startDate)} to ${formatDate(data.range.endDate)}. Let's see where it went.`}
        onColor={onColor}
      />
    </WrappedCard>
  )
}

export function TotalSpentCard({ data, color, onColor }: CardProps) {
  const avgPerDay = data.range.daysTracked > 0 ? data.totalSpent / data.range.daysTracked : 0
  return (
    <WrappedCard color={color} onColor={onColor} eyebrow="Total spent">
      <WrappedBigNumber value={formatCurrency(data.totalSpent)} onColor={onColor} />
      <WrappedCaption
        value={`across ${data.totalTransactions} transactions — about ${formatCurrency(avgPerDay)} a day.`}
        onColor={onColor}
      />
    </WrappedCard>
  )
}

export function TopCategoryCard({ data, color, onColor }: CardProps) {
  const top = data.topCategories[0]
  if (!top) return null
  return (
    <WrappedCard color={color} onColor={onColor} eyebrow="Your top category">
      <WrappedBigNumber value={top.category} onColor={onColor} />
      <WrappedCaption
        value={`${formatCurrency(top.total)} — ${top.pct.toFixed(0)}% of everything you spent.`}
        onColor={onColor}
      />
    </WrappedCard>
  )
}

export function BiggestPurchaseCard({ data, color, onColor }: CardProps) {
  const p = data.biggestPurchase
  if (!p) return null
  return (
    <WrappedCard color={color} onColor={onColor} eyebrow="Biggest single purchase">
      <WrappedBigNumber value={formatCurrency(p.amountInr)} onColor={onColor} />
      <WrappedCaption value={`${p.item} · ${p.category} · ${formatDate(p.date)}`} onColor={onColor} />
    </WrappedCard>
  )
}

export function TopWeekdayCard({ data, color, onColor }: CardProps) {
  const w = data.topWeekday
  if (!w) return null
  return (
    <WrappedCard color={color} onColor={onColor} eyebrow="Your spendiest day">
      <WrappedBigNumber value={w.day} onColor={onColor} />
      <WrappedCaption
        value={`${formatCurrency(w.total)} total across ${w.count} purchases. You have a type.`}
        onColor={onColor}
      />
    </WrappedCard>
  )
}

// Opacity steps of onColor, not theme tokens — this bar sits on a saturated
// accent background, so it needs its own contrast-safe palette.
const BREAKDOWN_OPACITY = [1, 0.8, 0.62, 0.46, 0.32]

export function CategoryBreakdownCard({ data, color, onColor }: CardProps) {
  const total = data.topCategories.reduce((s, c) => s + c.total, 0)
  if (total <= 0) return null

  let cursor = 0
  const bars = data.topCategories.map((c, i) => {
    const pct = (c.total / total) * 100
    const bar = { key: c.category, x: cursor, width: pct, opacity: BREAKDOWN_OPACITY[i % BREAKDOWN_OPACITY.length] }
    cursor += pct
    return bar
  })

  return (
    <WrappedCard color={color} onColor={onColor} eyebrow="Where it all went">
      <View style={{ gap: 16 }}>
        <View style={styles.barClip}>
          <Svg width="100%" height={12} viewBox="0 0 100 12" preserveAspectRatio="none">
            {bars.map((b) => (
              <Rect key={b.key} x={b.x} y={0} width={b.width} height={12} fill={onColor} opacity={b.opacity} />
            ))}
          </Svg>
        </View>
        <View style={{ gap: 8 }}>
          {data.topCategories.map((c, i) => (
            <View key={c.category} style={styles.legendRow}>
              <View style={[styles.dot, { backgroundColor: onColor, opacity: BREAKDOWN_OPACITY[i % BREAKDOWN_OPACITY.length] }]} />
              <Text style={[styles.legendLabel, { color: onColor, fontFamily: fontFamily.bodyMedium }]} numberOfLines={1}>
                {c.category}
              </Text>
              <Text style={[styles.legendPct, { color: onColor, fontFamily: fontFamily.bodySemiBold }]}>
                {c.pct.toFixed(0)}%
              </Text>
            </View>
          ))}
        </View>
      </View>
    </WrappedCard>
  )
}

export function StreakCard({ data, color, onColor }: CardProps) {
  const streak = data.longestStreak
  if (!streak) return null
  return (
    <WrappedCard color={color} onColor={onColor} eyebrow="Longest logging streak">
      <WrappedBigNumber value={`${streak.days} day${streak.days === 1 ? '' : 's'}`} onColor={onColor} />
      <WrappedCaption
        value={
          data.longestGap
            ? `${formatDate(streak.startDate)} → ${formatDate(streak.endDate)}. Longest gap: ${data.longestGap.days} days.`
            : `${formatDate(streak.startDate)} → ${formatDate(streak.endDate)}.`
        }
        onColor={onColor}
      />
    </WrappedCard>
  )
}

const styles = StyleSheet.create({
  barClip: { borderRadius: 6, overflow: 'hidden' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 14 },
  legendPct: { fontSize: 14 },
})
