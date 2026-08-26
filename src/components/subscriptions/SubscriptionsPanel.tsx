import { useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronRight, ChevronDown } from 'lucide-react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { formatCurrency } from '@/src/lib/format'
import { useCancelSubscription, useReactivateSubscription } from '@/src/hooks/useSubscriptions'
import { Icon } from '@/src/components/shared/Icon'
import type { SubscriptionRow } from '@/src/types'

interface Props {
  subscriptions: SubscriptionRow[]
  hideAmounts: boolean
}

function monthlyEq(sub: SubscriptionRow): number {
  const amt = Number(sub.amount_inr) || 0
  if (/yearly|annual/i.test(sub.billing_cycle)) return amt / 12
  if (/quarterly/i.test(sub.billing_cycle)) return amt / 3
  if (/weekly/i.test(sub.billing_cycle)) return amt * 4.33
  return amt
}

function cleanCycle(cycle: string): string {
  if (/one-time/i.test(cycle)) return 'one-time'
  if (/monthly/i.test(cycle)) return 'monthly'
  if (/yearly|annual/i.test(cycle)) return 'yearly'
  if (/quarterly/i.test(cycle)) return 'quarterly'
  if (/weekly/i.test(cycle)) return 'weekly'
  return cycle
}

function rollForward(dateStr: string, cycle: string): string {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  if (/yearly|annual/i.test(cycle)) d.setFullYear(d.getFullYear() + 1)
  else if (/quarterly/i.test(cycle)) d.setMonth(d.getMonth() + 3)
  else if (/weekly/i.test(cycle)) d.setDate(d.getDate() + 7)
  else d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 10)
}

// ponytail: skips web's renewal_or_end_month/timestamp fallback chain for subs
// missing next_due_date — add if mobile-added subs start missing that field.
function effectiveDueDate(sub: SubscriptionRow): string {
  if (!sub.next_due_date) return ''
  let d = new Date(sub.next_due_date)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  while (d <= now) {
    const rolled = rollForward(d.toISOString().slice(0, 10), sub.billing_cycle)
    if (!rolled) break
    d = new Date(rolled)
  }
  return d.toISOString().slice(0, 10)
}

function daysUntil(dateStr: string): string {
  if (!dateStr) return ''
  const diff = Math.round((new Date(dateStr).getTime() - Date.now()) / 86400000)
  if (diff < 0) return ''
  if (diff === 0) return 'renews today'
  if (diff === 1) return 'renews tomorrow'
  return `renews in ${diff}d`
}

export function SubscriptionsPanel({ subscriptions, hideAmounts }: Props) {
  const { tokens } = useTheme()
  const router = useRouter()
  const cancelSub = useCancelSubscription()
  const reactivateSub = useReactivateSubscription()
  const [mutatingService, setMutatingService] = useState<string | null>(null)
  const [expanded, setExpanded] = useState({ active: true, cancelled: false })

  const active = useMemo(
    () => subscriptions.filter((s) => /^active/i.test(s.status)).sort((a, b) => monthlyEq(b) - monthlyEq(a)),
    [subscriptions],
  )
  const cancelled = useMemo(() => subscriptions.filter((s) => !/^active/i.test(s.status)), [subscriptions])

  const totalMonthly = Math.round(active.reduce((s, sub) => s + monthlyEq(sub), 0))
  const totalYearly = Math.round(totalMonthly * 12)

  function handleCancel(service: string) {
    setMutatingService(service)
    cancelSub.mutate(service, { onSettled: () => setMutatingService(null) })
  }

  function handleReactivate(service: string) {
    setMutatingService(service)
    reactivateSub.mutate(service, { onSettled: () => setMutatingService(null) })
  }

  return (
    <View>
      <View style={styles.totalsRow}>
        <Text style={{ color: tokens.text, fontSize: 13, fontFamily: fontFamily.bodyMedium }}>
          <Text style={{ fontFamily: fontFamily.bodyBold }}>
            {hideAmounts ? '₹••••' : `~${formatCurrency(totalMonthly)}`}
          </Text>{' '}
          /mo
        </Text>
        <Text style={{ color: tokens.text, fontSize: 13, fontFamily: fontFamily.bodyMedium }}>
          <Text style={{ fontFamily: fontFamily.bodyBold }}>{active.length}</Text> active
        </Text>
        <Text style={{ color: tokens.text, fontSize: 13, fontFamily: fontFamily.bodyMedium }}>
          <Text style={{ fontFamily: fontFamily.bodyBold }}>
            {hideAmounts ? '₹••••' : `~${formatCurrency(totalYearly)}`}
          </Text>{' '}
          /yr
        </Text>
      </View>

      {active.length > 0 && (
        <View style={{ marginTop: 14 }}>
          <Text style={[styles.breakdownLabel, { color: tokens.text3 }]}>% of monthly spend</Text>
          {active.map((sub) => {
            const meq = monthlyEq(sub)
            const pct = totalMonthly > 0 ? (meq / totalMonthly) * 100 : 0
            return (
              <View key={sub.service} style={styles.barRow}>
                <Text numberOfLines={1} style={[styles.barLabel, { color: tokens.text2 }]}>
                  {sub.service}
                </Text>
                <View style={[styles.barTrack, { backgroundColor: tokens.inputBg }]}>
                  <View style={[styles.barFill, { width: `${Math.max(3, pct)}%`, backgroundColor: tokens.accent }]} />
                </View>
                <Text style={[styles.barValue, { color: tokens.text2 }]}>
                  {Math.round(pct)}% · {formatCurrency(Math.round(meq), hideAmounts)}/mo
                </Text>
              </View>
            )
          })}
        </View>
      )}

      <View style={{ marginTop: 14 }}>
        <Pressable
          style={styles.sectionHead}
          onPress={() => setExpanded((e) => ({ ...e, active: !e.active }))}
        >
          <Text style={[styles.sectionTitle, { color: tokens.text3 }]}>ACTIVE ({active.length})</Text>
          <Icon icon={expanded.active ? ChevronDown : ChevronRight} size={14} color={tokens.text3} />
        </Pressable>
        {expanded.active &&
          active.map((sub) => {
            const renew = daysUntil(effectiveDueDate(sub))
            const isYearly = /yearly|annual/i.test(sub.billing_cycle)
            const meta = [cleanCycle(sub.billing_cycle), renew, formatCurrency(Number(sub.amount_inr) || 0, hideAmounts)]
              .filter(Boolean)
              .join(' · ')
            return (
              <View key={sub.service} style={[styles.row, { borderTopColor: tokens.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: tokens.text, fontSize: 14, fontFamily: fontFamily.bodySemiBold }}>
                    {sub.service}
                  </Text>
                  <Text style={{ color: tokens.text2, fontSize: 12, marginTop: 2 }}>
                    {meta}
                    {isYearly ? ` (${formatCurrency(Math.round(monthlyEq(sub)), hideAmounts)}/mo)` : ''}
                  </Text>
                </View>
                <View style={styles.rowActions}>
                  <Pressable
                    hitSlop={8}
                    onPress={() => router.push({ pathname: '/modals/subscription', params: { service: sub.service } })}
                  >
                    <Text style={{ fontSize: 15 }}>✏️</Text>
                  </Pressable>
                  {mutatingService === sub.service ? (
                    <Text style={{ color: tokens.text3, fontSize: 12 }}>…</Text>
                  ) : (
                    <Pressable
                      style={[styles.actionBtn, { borderColor: tokens.border }]}
                      onPress={() => handleCancel(sub.service)}
                    >
                      <Text style={{ color: tokens.coral, fontSize: 12, fontFamily: fontFamily.bodySemiBold }}>
                        Cancel
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )
          })}
      </View>

      <View style={{ marginTop: 10 }}>
        <Pressable
          style={styles.sectionHead}
          onPress={() => setExpanded((e) => ({ ...e, cancelled: !e.cancelled }))}
        >
          <Text style={[styles.sectionTitle, { color: tokens.text3 }]}>CANCELLED ({cancelled.length})</Text>
          <Icon icon={expanded.cancelled ? ChevronDown : ChevronRight} size={14} color={tokens.text3} />
        </Pressable>
        {expanded.cancelled &&
          (cancelled.length > 0 ? (
            cancelled.map((sub) => (
              <View key={sub.service} style={[styles.row, { borderTopColor: tokens.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: tokens.text, fontSize: 14, fontFamily: fontFamily.bodySemiBold }}>
                    {sub.service}
                  </Text>
                  <Text style={{ color: tokens.text2, fontSize: 12, marginTop: 2 }}>
                    {sub.renewal_or_end_month || 'n/a'}
                  </Text>
                </View>
                <View style={styles.rowActions}>
                  <Pressable
                    hitSlop={8}
                    onPress={() => router.push({ pathname: '/modals/subscription', params: { service: sub.service } })}
                  >
                    <Text style={{ fontSize: 15 }}>✏️</Text>
                  </Pressable>
                  {mutatingService === sub.service ? (
                    <Text style={{ color: tokens.text3, fontSize: 12 }}>…</Text>
                  ) : (
                    <Pressable
                      style={[styles.actionBtn, { borderColor: tokens.border }]}
                      onPress={() => handleReactivate(sub.service)}
                    >
                      <Text style={{ color: tokens.mint, fontSize: 12, fontFamily: fontFamily.bodySemiBold }}>
                        Reactivate
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))
          ) : (
            <Text style={{ color: tokens.text3, fontSize: 12, marginTop: 8 }}>No cancelled subscriptions.</Text>
          ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  breakdownLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  barLabel: { width: 76, fontSize: 11 },
  barTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  barValue: { fontSize: 11, width: 90, textAlign: 'right' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  sectionTitle: { fontSize: 11, letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 10, gap: 10 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
})
