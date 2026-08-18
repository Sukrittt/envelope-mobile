import { View, Text, Pressable, StyleSheet } from 'react-native'
import Svg, { Rect } from 'react-native-svg'
import type { WrappedData } from '@/src/api/wrapped'
import { formatCurrency, formatDate } from '@/src/lib/format'
import { fontFamily } from '@/src/theme/fonts'
import { WrappedCard, WrappedBigNumber, WrappedCaption, type BlobSpec } from './WrappedCard'

interface CardProps {
  data: WrappedData
  color: string
  onColor: string
}

export function CoverCard({
  data,
  color,
  onColor,
  onStart,
  onStartMuted,
}: CardProps & { onStart: () => void; onStartMuted: () => void }) {
  return (
    <WrappedCard
      color={color}
      onColor={onColor}
      blobs={[
        { size: 200, top: -60, right: -50, color: `${onColor}55`, motion: 'drift', durationMs: 11000 },
        { size: 150, bottom: 40, left: -50, color: `${onColor}33`, motion: 'drift2', durationMs: 14000 },
      ]}
    >
      <Text style={[styles.eyebrowInline, { color: onColor, fontFamily: fontFamily.bodyBold }]}>2026 RECAP</Text>
      <Text style={[styles.coverTitle, { color: onColor, fontFamily: fontFamily.displayBold }]}>Expense{'\n'}Wrapped</Text>
      <WrappedCaption
        value={`${data.totalTransactions} transactions. Zero secrets. Let's talk about your year.`}
        onColor={onColor}
      />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <Pressable onPress={onStart} style={[styles.coverButton, { backgroundColor: onColor }]}>
          <Text style={[styles.coverButtonText, { color, fontFamily: fontFamily.displaySemiBold }]}>Play with sound ♫</Text>
        </Pressable>
        <Pressable onPress={onStartMuted} style={[styles.coverButtonGhost, { borderColor: `${onColor}66` }]}>
          <Text style={[styles.coverButtonGhostText, { color: onColor, fontFamily: fontFamily.bodyExtraBold }]}>Silent</Text>
        </Pressable>
      </View>
    </WrappedCard>
  )
}

export function IntroCard({ data, color, onColor }: CardProps) {
  return (
    <WrappedCard
      color={color}
      onColor={onColor}
      eyebrow="You showed up"
      blobs={[
        { size: 200, top: 60, left: -70, color: `${onColor}22`, motion: 'drift', durationMs: 13000 },
        { size: 100, bottom: 90, right: -20, color: `${onColor}33`, motion: 'spin', durationMs: 30000, borderRadius: 24 },
      ]}
    >
      <WrappedBigNumber value={`${data.range.daysTracked} days`} onColor={onColor} />
      <WrappedCaption
        value={`of logging every rupee, tracked from ${formatDate(data.range.startDate)} to ${formatDate(data.range.endDate)}.`}
        onColor={onColor}
      />
    </WrappedCard>
  )
}

export function TotalSpentCard({ data, color, onColor }: CardProps) {
  const avgPerDay = data.range.daysTracked > 0 ? data.totalSpent / data.range.daysTracked : 0
  return (
    <WrappedCard
      color={color}
      onColor={onColor}
      eyebrow="The grand total"
      blobs={[{ size: 280, top: -90, left: -60, color: `${onColor}22`, motion: 'drift2', durationMs: 12000 }]}
    >
      <WrappedBigNumber value={formatCurrency(data.totalSpent)} onColor={onColor} />
      <WrappedCaption
        value={`about ${formatCurrency(avgPerDay)} a day, every day, across ${data.totalTransactions} transactions.`}
        onColor={onColor}
      />
    </WrappedCard>
  )
}

export function TopCategoryCard({ data, color, onColor }: CardProps) {
  const top = data.topCategories[0]
  if (!top) return null
  return (
    <WrappedCard
      color={color}
      onColor={onColor}
      eyebrow="Your #1 category"
      blobs={[
        { size: 170, top: -40, right: -50, color: `${onColor}22`, motion: 'spin', durationMs: 40000, borderRadius: 40 },
        { size: 130, bottom: 70, left: -40, color: `${onColor}22`, motion: 'drift', durationMs: 15000 },
      ]}
    >
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
    <WrappedCard
      color={color}
      onColor={onColor}
      eyebrow="Biggest single hit"
      blobs={[{ size: 200, bottom: -60, right: -60, color: `${onColor}22`, motion: 'drift2', durationMs: 13000 }]}
    >
      <View style={[styles.panel, { backgroundColor: `${onColor}22`, borderColor: `${onColor}44` }]}>
        <Text style={[styles.panelBig, { color: onColor, fontFamily: fontFamily.displayBold }]}>
          {formatCurrency(p.amountInr)}
        </Text>
        <Text style={[styles.panelSub, { color: onColor, fontFamily: fontFamily.bodyExtraBold }]}>
          {p.item} · {p.category} · {formatDate(p.date)}
        </Text>
      </View>
      <WrappedCaption value="One tap, a whole lot of average days worth of spending." onColor={onColor} />
    </WrappedCard>
  )
}

const WEEKDAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function TopWeekdayCard({ data, color, onColor }: CardProps) {
  const w = data.topWeekday
  if (!w) return null
  return (
    <WrappedCard
      color={color}
      onColor={onColor}
      eyebrow="Your spendiest day"
      blobs={[{ size: 220, top: -70, left: -70, color: `${onColor}22`, motion: 'spin', durationMs: 50000, borderRadius: 50 }]}
    >
      <WrappedBigNumber value={w.day} onColor={onColor} />
      <WrappedCaption value={`${formatCurrency(w.total)} across ${w.count} purchases. You have a type.`} onColor={onColor} />
      <View style={styles.weekdayRow}>
        {WEEKDAY_ORDER.map((day) => {
          const active = day === w.day
          return (
            <View
              key={day}
              style={[
                styles.weekdayBar,
                { backgroundColor: active ? onColor : `${onColor}33`, height: active ? 44 : 18 + (day.length % 3) * 8 },
              ]}
            />
          )
        })}
      </View>
      <View style={styles.weekdayLabels}>
        {WEEKDAY_ORDER.map((day) => (
          <Text key={day} style={[styles.weekdayLabel, { color: onColor, fontFamily: fontFamily.bodyExtraBold }]}>
            {day[0]}
          </Text>
        ))}
      </View>
    </WrappedCard>
  )
}

export function MonthRaceCard({ data, color, onColor }: CardProps) {
  const months = data.monthlyTotals
  if (months.length === 0) return null
  const max = Math.max(...months.map((m) => m.total))
  const top = [...months].sort((a, b) => b.total - a.total)[0]
  return (
    <WrappedCard color={color} onColor={onColor} eyebrow="Month by month">
      <Text style={[styles.raceTitle, { color: onColor, fontFamily: fontFamily.displayBold }]}>
        {top.label} won.{'\n'}Of course it did.
      </Text>
      <View style={{ gap: 10, marginTop: 8 }}>
        {months.map((m) => (
          <View key={m.month} style={styles.raceRow}>
            <Text style={[styles.raceLabel, { color: onColor, fontFamily: fontFamily.bodyExtraBold }]}>{m.label}</Text>
            <View style={[styles.raceTrack, { backgroundColor: `${onColor}22` }]}>
              <View
                style={[
                  styles.raceFill,
                  { width: `${max > 0 ? (m.total / max) * 100 : 0}%`, backgroundColor: m.month === top.month ? onColor : `${onColor}99` },
                ]}
              />
            </View>
            <Text style={[styles.raceValue, { color: onColor, fontFamily: fontFamily.bodyExtraBold }]}>
              {formatCurrency(m.total)}
            </Text>
          </View>
        ))}
      </View>
    </WrappedCard>
  )
}

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

export function StreakCard({ data, color, onColor, moneySaved }: CardProps & { moneySaved?: number }) {
  const streak = data.longestStreak
  if (!streak) return null
  const saved = moneySaved
  return (
    <WrappedCard
      color={color}
      onColor={onColor}
      eyebrow="Longest logging streak"
      blobs={[{ size: 180, top: -50, right: -60, color: `${onColor}22`, motion: 'spin', durationMs: 45000, borderRadius: 40 }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
        <WrappedBigNumber value={`${streak.days}`} onColor={onColor} />
        <Text style={[styles.streakDaysLabel, { color: onColor, fontFamily: fontFamily.displaySemiBold }]}>days 🔥</Text>
      </View>
      <WrappedCaption
        value={
          data.longestGap
            ? `${formatDate(streak.startDate)} → ${formatDate(streak.endDate)}. Longest gap: ${data.longestGap.days} days.`
            : `${formatDate(streak.startDate)} → ${formatDate(streak.endDate)}.`
        }
        onColor={onColor}
      />
      {saved !== undefined && saved > 0 && (
        <View style={[styles.panel, { backgroundColor: `${onColor}22`, borderColor: `${onColor}44` }]}>
          <Text style={[styles.panelEyebrow, { color: onColor, fontFamily: fontFamily.bodyExtraBold }]}>MONEY THAT STAYED PUT</Text>
          <Text style={[styles.panelBigSmall, { color: onColor, fontFamily: fontFamily.displayBold }]}>{formatCurrency(saved)}</Text>
          <Text style={[styles.panelSub, { color: onColor, fontFamily: fontFamily.bodySemiBold }]}>left in envelopes, unspent.</Text>
        </View>
      )}
    </WrappedCard>
  )
}

interface Badge {
  emoji: string
  title: string
  sub: string
}

export function BadgesCard({ data, color, onColor }: CardProps) {
  const badges: Badge[] = []
  if (data.longestStreak) badges.push({ emoji: '🔥', title: 'Streak Freak', sub: `${data.longestStreak.days} days unbroken` })
  badges.push({ emoji: '🧾', title: 'Receipt Hoarder', sub: `${data.totalTransactions} logs` })
  if (data.biggestPurchase) badges.push({ emoji: '💸', title: 'Big Mover', sub: `${formatCurrency(data.biggestPurchase.amountInr)} in one go` })
  if (data.topWeekday) badges.push({ emoji: '📅', title: `${data.topWeekday.day} Loyalist`, sub: `${data.topWeekday.count} purchases` })

  return (
    <WrappedCard color={color} onColor={onColor} eyebrow="Badges earned">
      <Text style={[styles.raceTitle, { color: onColor, fontFamily: fontFamily.displayBold }]}>
        {badges.length} for you.
      </Text>
      <View style={styles.badgeGrid}>
        {badges.map((b) => (
          <View key={b.title} style={[styles.badgeTile, { backgroundColor: `${onColor}22`, borderColor: `${onColor}44` }]}>
            <Text style={styles.badgeEmoji}>{b.emoji}</Text>
            <Text style={[styles.badgeTitle, { color: onColor, fontFamily: fontFamily.displaySemiBold }]}>{b.title}</Text>
            <Text style={[styles.badgeSub, { color: onColor, fontFamily: fontFamily.bodyBold }]}>{b.sub}</Text>
          </View>
        ))}
      </View>
    </WrappedCard>
  )
}

const ARCHETYPES: Record<string, { emoji: string; title: string; blurb: string }> = {
  bills: { emoji: '🧾', title: 'The Bill Whisperer', blurb: 'You pay everything before it’s due, responsible to a fault.' },
  rent: { emoji: '🏠', title: 'The Homebody', blurb: 'Rent first, everything else negotiable. A steady hand.' },
  food: { emoji: '🍜', title: 'The Flavor Chaser', blurb: 'Every meal is a small event. No regrets, mostly.' },
  groceries: { emoji: '🛒', title: 'The Provisioner', blurb: 'Always stocked, always planning three meals ahead.' },
  shopping: { emoji: '🛍️', title: 'The Collector', blurb: 'One more thing never hurt anyone. Probably.' },
  investments: { emoji: '📈', title: 'The Quiet Investor', blurb: 'Moves money into the future like it’s nothing.' },
  travel: { emoji: '✈️', title: 'The Wanderer', blurb: 'Home is wherever the itinerary says next.' },
  entertainment: { emoji: '🎬', title: 'The Main Character', blurb: 'Every week deserves a little spectacle.' },
  transport: { emoji: '🚕', title: 'The Commuter', blurb: 'Always in motion, always somewhere to be.' },
}

const DEFAULT_ARCHETYPE = { emoji: '💳', title: 'The Steady Spender', blurb: 'Consistent, deliberate, and hard to predict.' }

export function ArchetypeCard({ data, color, onColor }: CardProps) {
  const top = data.topCategories[0]
  const archetype = top ? (ARCHETYPES[top.category.toLowerCase()] ?? DEFAULT_ARCHETYPE) : DEFAULT_ARCHETYPE
  return (
    <WrappedCard color={color} onColor={onColor} eyebrow="Your spending personality">
      <Text style={styles.archetypeEmoji}>{archetype.emoji}</Text>
      <Text style={[styles.coverTitle, { color: onColor, fontFamily: fontFamily.displayBold, fontSize: 40 }]}>
        {archetype.title}
      </Text>
      <WrappedCaption value={archetype.blurb} onColor={onColor} />
    </WrappedCard>
  )
}

const styles = StyleSheet.create({
  barClip: { borderRadius: 6, overflow: 'hidden' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 14 },
  legendPct: { fontSize: 14 },
  eyebrowInline: { fontSize: 12, letterSpacing: 2, opacity: 0.8 },
  coverTitle: { fontSize: 54, lineHeight: 52, marginTop: 4 },
  coverButton: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 100 },
  coverButtonText: { fontSize: 15 },
  coverButtonGhost: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 100, borderWidth: 1 },
  coverButtonGhostText: { fontSize: 13 },
  panel: { borderRadius: 22, borderWidth: 1, padding: 20, gap: 8, marginTop: 8 },
  panelBig: { fontSize: 40, lineHeight: 42 },
  panelBigSmall: { fontSize: 32, lineHeight: 34 },
  panelSub: { fontSize: 13, opacity: 0.9 },
  panelEyebrow: { fontSize: 11, letterSpacing: 1.5, opacity: 0.8 },
  weekdayRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 48, marginTop: 20 },
  weekdayBar: { flex: 1, borderRadius: 6 },
  weekdayLabels: { flexDirection: 'row', gap: 5, marginTop: 6 },
  weekdayLabel: { flex: 1, fontSize: 10, textAlign: 'center', opacity: 0.75 },
  raceTitle: { fontSize: 28, lineHeight: 32 },
  raceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  raceLabel: { width: 32, fontSize: 12, opacity: 0.8 },
  raceTrack: { flex: 1, height: 18, borderRadius: 100, overflow: 'hidden' },
  raceFill: { height: '100%', borderRadius: 100 },
  raceValue: { width: 60, textAlign: 'right', fontSize: 12 },
  streakDaysLabel: { fontSize: 22 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  badgeTile: { width: '47%', borderRadius: 18, borderWidth: 1, padding: 14, gap: 4 },
  badgeEmoji: { fontSize: 22 },
  badgeTitle: { fontSize: 15 },
  badgeSub: { fontSize: 11, opacity: 0.85 },
  archetypeEmoji: { fontSize: 44 },
})
