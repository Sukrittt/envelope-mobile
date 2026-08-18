import { View, Text, Pressable, StyleSheet } from 'react-native'
import Svg, { Rect } from 'react-native-svg'
import type { WrappedData } from '@/src/api/wrapped'
import { formatCurrency, formatDate } from '@/src/lib/format'
import { fontFamily } from '@/src/theme/fonts'
import {
  WrappedCard,
  WrappedBigNumber,
  WrappedCaption,
  WrappedGlow,
  WFade,
  WRise,
  WPop,
  WGrowX,
  WNudge,
  type BlobSpec,
} from './WrappedCard'

interface CardProps {
  data: WrappedData
  color: string
  onColor: string
}

const MONTH_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

export function CoverCard({
  data,
  color,
  onColor,
  onStart,
  onStartMuted,
}: CardProps & { onStart: () => void; onStartMuted: () => void }) {
  const start = new Date(data.range.startDate)
  const end = new Date(data.range.endDate)
  const rangeLabel = Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
    ? '2026 RECAP'
    : `${end.getFullYear()} · ${MONTH_ABBR[start.getMonth()]} → ${MONTH_ABBR[end.getMonth()]}`

  return (
    <WrappedCard
      color={color}
      onColor={onColor}
      blobs={[
        { size: 300, top: -90, right: -80, color: 'rgba(205, 166, 41, 0.55)', motion: 'drift', durationMs: 11000 },
        { size: 220, bottom: 60, left: -70, color: 'rgba(207, 66, 50, 0.38)', motion: 'drift2', durationMs: 14000 },
      ]}
    >
      <WFade>
        <Text style={[styles.eyebrowInline, { color: onColor, fontFamily: fontFamily.bodyBold }]}>{rangeLabel}</Text>
      </WFade>
      <WRise delay={50}>
        <Text style={[styles.coverTitle, { color: onColor, fontFamily: fontFamily.displayBold }]}>Expense{'\n'}Wrapped</Text>
      </WRise>
      <WRise delay={180}>
        <WrappedCaption
          value={`${data.totalTransactions} transactions. Zero secrets. Let's talk about your year.`}
          onColor={onColor}
        />
      </WRise>
      <WRise delay={300} style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <Pressable onPress={onStart} style={[styles.coverButton, { backgroundColor: onColor }]}>
          <Text style={[styles.coverButtonText, { color, fontFamily: fontFamily.displaySemiBold }]}>Play with sound ♫</Text>
        </Pressable>
        <Pressable onPress={onStartMuted} style={[styles.coverButtonGhost, { borderColor: `${onColor}66` }]}>
          <Text style={[styles.coverButtonGhostText, { color: onColor, fontFamily: fontFamily.bodyExtraBold }]}>Silent</Text>
        </Pressable>
      </WRise>
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
        { size: 330, top: 120, left: -120, color: 'rgba(180, 141, 244, 0.3)', variant: 'ring', ringWidth: 26, motion: 'drift', durationMs: 13000 },
        { size: 150, bottom: 170, right: -40, color: 'rgba(0, 186, 197, 0.3)', motion: 'spin', durationMs: 30000, borderRadius: 34 },
      ]}
    >
      <WPop delay={80}>
        <WrappedBigNumber value={`${data.range.daysTracked} days`} onColor={onColor} />
      </WPop>
      <WRise delay={260}>
        <WrappedCaption
          value={`of logging every rupee, tracked from ${formatDate(data.range.startDate)} to ${formatDate(data.range.endDate)}.`}
          onColor={onColor}
        />
      </WRise>
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
      blobs={[{ size: 420, top: -140, left: -100, color: 'rgba(51, 172, 90, 0.28)', motion: 'drift2', durationMs: 12000 }]}
    >
      <WPop delay={100}>
        <WrappedBigNumber value={formatCurrency(data.totalSpent)} onColor={onColor} />
      </WPop>
      <WRise delay={280}>
        <WrappedCaption
          value={`about ${formatCurrency(avgPerDay)} a day, every day, across ${data.totalTransactions} transactions.`}
          onColor={onColor}
        />
      </WRise>
    </WrappedCard>
  )
}

export function TopCategoryCard({ data, color, onColor }: CardProps) {
  const top = data.topCategories[0]
  if (!top) return null
  const top3 = data.topCategories.slice(0, 3)
  const maxTotal = top3[0]?.total ?? 1
  const barOpacity = [1, 0.5, 0.32]
  const barDelays = [450, 550, 650]

  return (
    <WrappedCard
      color={color}
      onColor={onColor}
      eyebrow="Your #1 category"
      blobs={[
        { size: 260, top: -60, right: -70, color: 'rgba(243, 100, 81, 0.32)', motion: 'spin', durationMs: 40000, borderRadius: 60 },
        { size: 190, bottom: 100, left: -60, color: 'rgba(226, 116, 171, 0.3)', motion: 'drift', durationMs: 15000 },
      ]}
    >
      <WPop delay={100}>
        <WrappedBigNumber value={top.category} onColor={onColor} />
      </WPop>
      <WRise delay={260}>
        <WrappedCaption
          value={`${formatCurrency(top.total)} — ${top.pct.toFixed(0)}% of everything you spent.`}
          onColor={onColor}
        />
      </WRise>
      {top3.length > 1 && (
        <View style={{ gap: 9, marginTop: 12 }}>
          {top3.map((c, i) => (
            <View key={c.category} style={styles.topCatBarRow}>
              <WGrowX
                delay={barDelays[i]}
                duration={800}
                style={[styles.topCatBarFill, { width: `${(c.total / maxTotal) * 68}%`, backgroundColor: onColor, opacity: barOpacity[i] }]}
              />
              <Text style={[styles.topCatBarLabel, { color: onColor, fontFamily: fontFamily.bodyExtraBold, opacity: barOpacity[i] }]}>
                {c.category}
              </Text>
            </View>
          ))}

        </View>
      )}
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
      blobs={[{ size: 300, bottom: -80, right: -90, color: 'rgba(215, 135, 233, 0.3)', variant: 'ring', ringWidth: 22, motion: 'drift2', durationMs: 13000 }]}
    >
      <WPop delay={100}>
        <View style={[styles.panel, { backgroundColor: `${onColor}22`, borderColor: `${onColor}44` }]}>
          <Text style={[styles.panelBig, { color: onColor, fontFamily: fontFamily.displayBold }]}>
            {formatCurrency(p.amountInr)}
          </Text>
          <Text style={[styles.panelSub, { color: onColor, fontFamily: fontFamily.bodyExtraBold }]}>
            {p.item} · {p.category} · {formatDate(p.date)}
          </Text>
        </View>
      </WPop>
      <WRise delay={300}>
        <WrappedCaption value="One tap, a whole lot of average days worth of spending." onColor={onColor} />
      </WRise>
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
      blobs={[{ size: 340, top: -100, left: -110, color: 'rgba(0, 175, 184, 0.28)', motion: 'spin', durationMs: 50000, borderRadius: 80 }]}
    >
      <WPop delay={80}>
        <WrappedBigNumber value={w.day} onColor={onColor} />
      </WPop>
      <WRise delay={260}>
        <WrappedCaption value={`${formatCurrency(w.total)} across ${w.count} purchases. You have a type.`} onColor={onColor} />
      </WRise>
      <WFade delay={350}>
        <View style={styles.weekdayRow}>
          {WEEKDAY_ORDER.map((day) => {
            const active = day === w.day
            const bar = (
              <View
                style={[
                  styles.weekdayBar,
                  { backgroundColor: active ? onColor : `${onColor}33`, height: active ? 44 : 18 + (day.length % 3) * 8 },
                ]}
              />
            )
            return active ? (
              <WNudge key={day} durationMs={2600} amplitude={7} style={{ flex: 1 }}>
                {bar}
              </WNudge>
            ) : (
              <View key={day} style={{ flex: 1 }}>
                {bar}
              </View>
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
      </WFade>
    </WrappedCard>
  )
}

const RACE_BAR_COLORS = [
  'rgba(221, 178, 39, 1)',
  'rgba(183, 185, 49, 1)',
  'rgba(90, 197, 118, 1)',
  'rgba(0, 191, 184, 1)',
  'rgba(219, 124, 212, 1)',
]

export function MonthRaceCard({ data, color, onColor }: CardProps) {
  const months = data.monthlyTotals ?? []
  if (months.length === 0) return null
  const max = Math.max(...months.map((m) => m.total))
  const top = [...months].sort((a, b) => b.total - a.total)[0]
  const n = months.length
  const fadeStep = n > 1 ? (600 - 200) / (n - 1) : 0
  const barStep = n > 1 ? (650 - 250) / (n - 1) : 0

  return (
    <WrappedCard
      color={color}
      onColor={onColor}
      eyebrow="Month by month"
      blobs={[{ size: 280, bottom: -90, left: -90, color: 'rgba(146, 96, 218, 0.28)', motion: 'drift', durationMs: 14000 }]}
    >
      <WRise delay={60}>
        <Text style={[styles.raceTitle, { color: onColor, fontFamily: fontFamily.displayBold }]}>
          {top.label} won.{'\n'}Of course it did.
        </Text>
      </WRise>
      <View style={{ gap: 10, marginTop: 8 }}>
        {months.map((m, i) => {
          const isTop = m.month === top.month
          return (
            <WFade key={m.month} delay={200 + i * fadeStep} style={styles.raceRow}>
              <Text style={[styles.raceLabel, { color: onColor, fontFamily: fontFamily.bodyExtraBold }]}>{m.label}</Text>
              <View style={[styles.raceTrack, { backgroundColor: `${onColor}22` }]}>
                <WGrowX
                  delay={250 + i * barStep}
                  duration={850}
                  style={[
                    styles.raceFill,
                    {
                      width: `${max > 0 ? (m.total / max) * 100 : 0}%`,
                      backgroundColor: isTop ? onColor : RACE_BAR_COLORS[i % RACE_BAR_COLORS.length],
                    },
                  ]}
                />
              </View>
              <Text style={[styles.raceValue, { color: onColor, fontFamily: fontFamily.bodyExtraBold }]}>
                {formatCurrency(m.total)}
              </Text>
            </WFade>
          )
        })}
      </View>
      <WRise delay={750}>
        <Text style={[styles.raceCloser, { color: onColor, fontFamily: fontFamily.bodySemiBold }]}>
          {top.label} was the peak. Everything else, comparatively quiet.
        </Text>
      </WRise>
    </WrappedCard>
  )
}

const BREAKDOWN_COLORS = [
  'rgba(168, 0, 39, 1)',
  'rgba(78, 56, 175, 1)',
  'rgba(0, 116, 52, 1)',
  'rgba(148, 34, 143, 1)',
  'rgba(0, 110, 133, 1)',
]

export function CategoryBreakdownCard({ data, color, onColor }: CardProps) {
  const total = data.topCategories.reduce((s, c) => s + c.total, 0)
  if (total <= 0) return null

  let cursor = 0
  const bars = data.topCategories.map((c, i) => {
    const pct = (c.total / total) * 100
    const bar = { key: c.category, x: cursor, width: pct, color: BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length] }
    cursor += pct
    return bar
  })
  const top5 = data.topCategories.slice(0, 5)
  const top5Pct = top5.reduce((s, c) => s + c.pct, 0)
  const restPct = Math.max(0, 100 - top5Pct)
  const legendStep = top5.length > 1 ? (540 - 300) / (top5.length - 1) : 0

  return (
    <WrappedCard
      color={color}
      onColor={onColor}
      eyebrow="Where it all went"
      blobs={[{ size: 300, bottom: -100, right: -80, color: 'rgba(209, 173, 65, 0.5)', motion: 'drift2', durationMs: 12000 }]}
    >
      <WRise delay={60}>
        <Text style={[styles.raceTitle, { color: onColor, fontFamily: fontFamily.displayBold }]}>
          Five categories ate most of it.
        </Text>
      </WRise>
      <View style={{ gap: 16, marginTop: 8 }}>
        <WGrowX delay={200} duration={900} style={styles.barClip}>
          <Svg width="100%" height={12} viewBox="0 0 100 12" preserveAspectRatio="none">
            {bars.map((b) => (
              <Rect key={b.key} x={b.x} y={0} width={b.width} height={12} fill={b.color} />
            ))}
          </Svg>
        </WGrowX>
        <View style={{ gap: 8 }}>
          {top5.map((c, i) => (
            <WRise key={c.category} delay={300 + i * legendStep} style={styles.legendRow}>
              <View style={[styles.dot, { backgroundColor: BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length] }]} />
              <Text style={[styles.legendLabel, { color: onColor, fontFamily: fontFamily.bodyMedium }]} numberOfLines={1}>
                {c.category}
              </Text>
              <Text style={[styles.legendPct, { color: onColor, fontFamily: fontFamily.bodySemiBold }]}>
                {c.pct.toFixed(0)}%
              </Text>
            </WRise>
          ))}
        </View>
      </View>
      {restPct > 0 && (
        <WRise delay={620}>
          <Text style={[styles.breakdownCloser, { color: onColor, fontFamily: fontFamily.bodySemiBold }]}>
            The other {restPct.toFixed(0)}%? Small stuff. Hundreds of tiny yeses.
          </Text>
        </WRise>
      )}
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
      blobs={[{ size: 240, top: -60, right: -70, color: 'rgba(76, 184, 106, 0.3)', variant: 'ring', ringWidth: 20, motion: 'spin', durationMs: 45000 }]}
    >
      <WPop delay={80}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
          <WrappedBigNumber value={`${streak.days}`} onColor={onColor} />
          <Text style={[styles.streakDaysLabel, { color: onColor, fontFamily: fontFamily.displaySemiBold }]}>days</Text>
          <WNudge durationMs={1800} amplitude={6}>
            <Text style={styles.streakFire}>🔥</Text>
          </WNudge>
        </View>
      </WPop>
      <WRise delay={240}>
        <WrappedCaption
          value={
            data.longestGap
              ? `${formatDate(streak.startDate)} → ${formatDate(streak.endDate)}. Longest gap: ${data.longestGap.days} days.`
              : `${formatDate(streak.startDate)} → ${formatDate(streak.endDate)}.`
          }
          onColor={onColor}
        />
      </WRise>
      {saved !== undefined && saved > 0 && (
        <WRise delay={360}>
          <View style={[styles.panel, { backgroundColor: `${onColor}22`, borderColor: `${onColor}44` }]}>
            <Text style={[styles.panelEyebrow, { color: onColor, fontFamily: fontFamily.bodyExtraBold }]}>MONEY THAT STAYED PUT</Text>
            <Text style={[styles.panelBigSmall, { color: onColor, fontFamily: fontFamily.displayBold }]}>{formatCurrency(saved)}</Text>
            <Text style={[styles.panelSub, { color: onColor, fontFamily: fontFamily.bodySemiBold }]}>left in envelopes, unspent.</Text>
          </View>
        </WRise>
      )}
    </WrappedCard>
  )
}

interface Badge {
  emoji: string
  title: string
  sub: string
}

const BADGE_DELAYS = [180, 260, 340, 420]

export function BadgesCard({ data, color, onColor }: CardProps) {
  const badges: Badge[] = []
  if (data.longestStreak) badges.push({ emoji: '🔥', title: 'Streak Freak', sub: `${data.longestStreak.days} days unbroken` })
  badges.push({ emoji: '🧾', title: 'Receipt Hoarder', sub: `${data.totalTransactions} logs` })
  if (data.biggestPurchase) badges.push({ emoji: '💸', title: 'Big Mover', sub: `${formatCurrency(data.biggestPurchase.amountInr)} in one go` })
  if (data.topWeekday) badges.push({ emoji: '📅', title: `${data.topWeekday.day} Loyalist`, sub: `${data.topWeekday.count} purchases` })

  return (
    <WrappedCard
      color={color}
      onColor={onColor}
      eyebrow="Badges earned"
      blobs={[{ size: 320, top: -110, left: -110, color: 'rgba(230, 112, 172, 0.26)', motion: 'drift', durationMs: 13000 }]}
    >
      <WRise delay={60}>
        <Text style={[styles.raceTitle, { color: onColor, fontFamily: fontFamily.displayBold }]}>
          {badges.length} for you.
        </Text>
      </WRise>
      <View style={styles.badgeGrid}>
        {badges.map((b, i) => (
          <WPop key={b.title} delay={BADGE_DELAYS[i % BADGE_DELAYS.length]} style={[styles.badgeTile, { backgroundColor: `${onColor}22`, borderColor: `${onColor}44` }]}>
            <Text style={styles.badgeEmoji}>{b.emoji}</Text>
            <Text style={[styles.badgeTitle, { color: onColor, fontFamily: fontFamily.displaySemiBold }]}>{b.title}</Text>
            <Text style={[styles.badgeSub, { color: onColor, fontFamily: fontFamily.bodyBold }]}>{b.sub}</Text>
          </WPop>
        ))}
      </View>
      <WRise delay={500}>
        <Text style={[styles.breakdownCloser, { color: onColor, fontFamily: fontFamily.bodySemiBold }]}>
          Keep logging — more badges unlock as your streak grows.
        </Text>
      </WRise>
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
      <WrappedGlow color="rgba(253, 131, 88, 0.35)" />
      <WPop delay={80}>
        <Text style={styles.archetypeEmoji}>{archetype.emoji}</Text>
      </WPop>
      <WPop delay={160}>
        <Text style={[styles.coverTitle, { color: onColor, fontFamily: fontFamily.displayBold, fontSize: 40 }]}>
          {archetype.title}
        </Text>
      </WPop>
      <WRise delay={320}>
        <WrappedCaption value={archetype.blurb} onColor={onColor} />
      </WRise>
      {top && (
        <WRise delay={440}>
          <View style={[styles.chip, { backgroundColor: `${onColor}22`, borderColor: `${onColor}44` }]}>
            <Text style={[styles.chipText, { color: onColor, fontFamily: fontFamily.bodyExtraBold }]}>
              {top.category} · {top.pct.toFixed(0)}%
            </Text>
          </View>
        </WRise>
      )}
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
  coverTitle: { fontSize: 54, lineHeight: 50, marginTop: 4, letterSpacing: -1.5 },
  coverButton: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 100 },
  coverButtonText: { fontSize: 15 },
  coverButtonGhost: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 100, borderWidth: 1 },
  coverButtonGhostText: { fontSize: 13 },
  panel: { borderRadius: 22, borderWidth: 1, padding: 20, gap: 8, marginTop: 8 },
  panelBig: { fontSize: 40, lineHeight: 42, letterSpacing: -1 },
  panelBigSmall: { fontSize: 32, lineHeight: 34, letterSpacing: -0.5 },
  panelSub: { fontSize: 13, opacity: 0.9 },
  panelEyebrow: { fontSize: 11, letterSpacing: 1.5, opacity: 0.8 },
  weekdayRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 48, marginTop: 20 },
  weekdayBar: { flex: 1, borderRadius: 6 },
  weekdayLabels: { flexDirection: 'row', gap: 5, marginTop: 6 },
  weekdayLabel: { flex: 1, fontSize: 10, textAlign: 'center', opacity: 0.75 },
  raceTitle: { fontSize: 28, lineHeight: 32, letterSpacing: -0.5 },
  raceCloser: { fontSize: 15, lineHeight: 21, opacity: 0.9, marginTop: 22 },
  breakdownCloser: { fontSize: 15, lineHeight: 21, opacity: 0.85, marginTop: 8 },
  raceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  raceLabel: { width: 32, fontSize: 12, opacity: 0.8 },
  raceTrack: { flex: 1, height: 18, borderRadius: 100, overflow: 'hidden' },
  raceFill: { height: '100%', borderRadius: 100 },
  raceValue: { width: 60, textAlign: 'right', fontSize: 12 },
  streakDaysLabel: { fontSize: 22 },
  streakFire: { fontSize: 28, marginLeft: 2 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  badgeTile: { width: '47%', borderRadius: 18, borderWidth: 1, padding: 14, gap: 4 },
  badgeEmoji: { fontSize: 22 },
  badgeTitle: { fontSize: 15 },
  badgeSub: { fontSize: 11, opacity: 0.85 },
  archetypeEmoji: { fontSize: 44 },
  chip: { alignSelf: 'flex-start', borderRadius: 100, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 14, marginTop: 4 },
  chipText: { fontSize: 12 },
  topCatBarRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topCatBarFill: { height: 12, borderRadius: 100 },
  topCatBarLabel: { fontSize: 11 },
})
