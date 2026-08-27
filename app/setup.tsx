import { useState } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus } from 'lucide-react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated'
import { useTheme } from '@/src/theme/ThemeProvider'
import type { ThemeTokens } from '@/src/theme/tokens'
import { fontFamily } from '@/src/theme/fonts'
import { Numpad } from '@/src/components/ui/Numpad'
import { StepDot } from '@/src/components/onboarding/StepDot'
import { PickRow } from '@/src/components/onboarding/PickRow'
import { SetupDone } from '@/src/components/onboarding/SetupDone'
import { AmountTicker } from '@/src/components/onboarding/AmountTicker'
import { BottomSheet } from '@/src/components/shared/Modal'
import { formatINR } from '@/src/lib/format'
import { currentMonthKey, INCOME_CATEGORY } from '@/src/lib/envelope'
import { updateBudget } from '@/src/api/budgets'
import { addGroup } from '@/src/api/groups'
import { addCategory } from '@/src/api/categories'
import { updateUser } from '@/src/api/account'
import { signalOnboarded } from '@/src/api/onboardingSignal'
import { DEFAULT_ALERT_PCTS } from '@/src/lib/alerts'

// SetupWizard.dc.html — income → groups → categories → assign → done. Writes
// land on finish (step 4's CTA), not per-step: groups/categories aren't
// reorderable or renameable server-side until they exist, so there's nothing
// worth syncing mid-flow.
const EMOJI_CYCLE = ['🏠', '🎬', '🌱', '🛒', '💡', '🚌', '🍜', '📺', '🛍', '🛟', '📈', '🎓', '🐶', '💊', '✈️', '🎁']
const QUICK_PICKS = ['30000', '50000', '75000', '100000']

interface Item {
  id: string
  emoji: string
  name: string
  on: boolean
}

interface LiveCat {
  key: string
  groupId: string
  catId: string
  gi: number
  emoji: string
  name: string
}

let nextId = 1
const makeId = () => `setup-${nextId++}`

function defaultGroups(): Item[] {
  return [
    { id: 'g1', emoji: '🏠', name: 'Essentials', on: true },
    { id: 'g2', emoji: '🎬', name: 'Lifestyle', on: true },
    { id: 'g3', emoji: '🌱', name: 'Savings', on: false },
  ]
}

function defaultCats(): Record<string, Item[]> {
  return {
    g1: [
      { id: makeId(), emoji: '🏠', name: 'Rent', on: true },
      { id: makeId(), emoji: '🛒', name: 'Groceries', on: true },
      { id: makeId(), emoji: '💡', name: 'Utilities', on: true },
      { id: makeId(), emoji: '🚌', name: 'Transport', on: false },
    ],
    g2: [
      { id: makeId(), emoji: '🍜', name: 'Eating out', on: true },
      { id: makeId(), emoji: '📺', name: 'Subscriptions', on: false },
      { id: makeId(), emoji: '🛍', name: 'Shopping', on: false },
    ],
    g3: [
      { id: makeId(), emoji: '🛟', name: 'Emergency fund', on: true },
      { id: makeId(), emoji: '📈', name: 'Investments', on: false },
    ],
  }
}

function nextEmoji(current: string): string {
  const i = EMOJI_CYCLE.indexOf(current)
  return EMOJI_CYCLE[(i + 1 + EMOJI_CYCLE.length) % EMOJI_CYCLE.length]
}

function label(item: Item): string {
  return `${item.emoji} ${item.name.trim()}`
}

async function ignoreConflict(err: unknown): Promise<void> {
  if (err instanceof Error && err.message.toLowerCase().includes('already exists')) return
  throw err
}

// SetupWizard.dc.html:345 — group 0 gets the biggest weighted share, group 1 next,
// every group after that (including "rest") shares the same smaller weight.
function groupWeight(gi: number, weighted: boolean): number {
  if (!weighted) return 1
  if (gi === 0) return 3
  if (gi === 1) return 2
  return 1.5
}

const TITLES: Record<number, [string, string]> = {
  1: ['What lands each month?', 'Your take-home income. This becomes the pot you assign from — you can change it any month.'],
  2: ['Group your money', 'Groups are the big buckets. Accept these or rename them to fit your life.'],
  3: ['Add your categories', 'These are the envelopes you actually spend from. Pick the ones you recognise.'],
  4: ['Assign every rupee', 'We suggested a split. Tap any amount to change it — the leftover has to reach zero.'],
}

function remainderColors(rem: number, tokens: ThemeTokens): { color: string; bg: string } {
  if (rem === 0) return { color: tokens.mint, bg: tokens.mintSoft }
  if (rem < 0) return { color: tokens.coral, bg: tokens.coralSoft }
  return { color: tokens.accentInk, bg: tokens.accentSoft }
}

export default function SetupScreen() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()

  const [step, setStep] = useState(1)
  const [income, setIncome] = useState('')
  // Drive AmountTicker's roll/flash/delta animation — mirrors SetupWizard.dc.html's
  // tick/dir/delta: `tick` forces a remount (replays the per-character entrance),
  // `dir` picks the roll direction, `delta` (quick-pick jumps only) floats a badge.
  const [tick, setTick] = useState(0)
  const [dir, setDir] = useState<1 | -1>(1)
  const [delta, setDelta] = useState(0)
  const [groups, setGroups] = useState<Item[]>(defaultGroups)
  const [cats, setCats] = useState<Record<string, Item[]>>(defaultCats)
  const [amounts, setAmounts] = useState<Record<string, number>>({})
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [buf, setBuf] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ income: number; groupCount: number; categoryCount: number; assigned: number } | null>(null)

  const selectedGroups = groups.filter((g) => g.on && g.name.trim())
  const selectedCatCount = selectedGroups.reduce(
    (n, g) => n + (cats[g.id] ?? []).filter((c) => c.on && c.name.trim()).length,
    0,
  )

  const liveCats = (): LiveCat[] => {
    const out: LiveCat[] = []
    selectedGroups.forEach((g, gi) => {
      ;(cats[g.id] ?? []).forEach((c) => {
        if (c.on && c.name.trim()) out.push({ key: `${g.id}:${c.id}`, groupId: g.id, catId: c.id, gi, emoji: c.emoji, name: c.name })
      })
    })
    return out
  }

  const assignedTotal = () => liveCats().reduce((n, c) => n + (amounts[c.key] ?? 0), 0)
  const remainder = () => (Number(income) || 0) - assignedTotal()

  const distribute = (weighted: boolean): Record<string, number> => {
    const items = liveCats()
    const incomeValue = Number(income) || 0
    if (!items.length) return {}
    const weights = items.map((it) => groupWeight(it.gi, weighted))
    const totalWeight = weights.reduce((a, b) => a + b, 0)
    const out: Record<string, number> = {}
    let used = 0
    items.forEach((it, idx) => {
      let v = idx === items.length - 1 ? incomeValue - used : Math.round((incomeValue * weights[idx]) / totalWeight / 100) * 100
      if (v < 0) v = 0
      used += v
      out[it.key] = v
    })
    return out
  }

  const canAdvance =
    step === 1
      ? Number(income) > 0
      : step === 2
        ? selectedGroups.length > 0
        : step === 3
          ? selectedCatCount > 0
          : step === 4
            ? remainder() === 0 && assignedTotal() > 0
            : true

  const patchGroup = (id: string, patch: Partial<Item>) =>
    setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)))

  const patchCat = (groupId: string, catId: string, patch: Partial<Item>) =>
    setCats((c) => ({ ...c, [groupId]: (c[groupId] ?? []).map((cat) => (cat.id === catId ? { ...cat, ...patch } : cat)) }))

  const addGroupRow = () => {
    const id = makeId()
    setGroups((gs) => [...gs, { id, emoji: '🎁', name: '', on: true }])
    setCats((c) => ({ ...c, [id]: [] }))
  }

  const addCatRow = (groupId: string) => {
    setCats((c) => ({ ...c, [groupId]: [...(c[groupId] ?? []), { id: makeId(), emoji: '🎁', name: '', on: true }] }))
  }

  const pressIncomeDigit = (d: string) => {
    setIncome((prev) => (prev + d).replace(/^0+/, '').slice(0, 9))
    setTick((t) => t + 1)
    setDir(1)
    setDelta(0)
  }

  const pressIncomeBackspace = () => {
    setIncome((prev) => prev.slice(0, -1))
    setTick((t) => t + 1)
    setDir(-1)
    setDelta(0)
  }

  const pickIncome = (v: string) => {
    const prev = Number(income) || 0
    const nextValue = Number(v)
    setIncome(v)
    setTick((t) => t + 1)
    setDir(nextValue >= prev ? 1 : -1)
    setDelta(nextValue - prev)
  }

  const back = () => {
    setError('')
    setStep((s) => Math.max(1, s - 1))
  }

  const openRow = (key: string) => {
    setActiveKey(key)
    setBuf('')
  }

  const closeRow = () => {
    setActiveKey(null)
    setBuf('')
  }

  const pressAmt = (k: string) => {
    if (!activeKey) return
    const nextBuf = k === 'del' ? buf.slice(0, -1) : (buf + k).replace(/^0+/, '').slice(0, 8)
    setBuf(nextBuf)
    setAmounts((prev) => ({ ...prev, [activeKey]: Number(nextBuf || 0) }))
  }

  const fillRemainder = () => {
    if (!activeKey) return
    const cur = amounts[activeKey] ?? 0
    const rest = assignedTotal() - cur
    const v = Math.max(0, (Number(income) || 0) - rest)
    setAmounts((prev) => ({ ...prev, [activeKey]: v }))
    setBuf(String(v))
  }

  const commit = async () => {
    if (pending) return
    setPending(true)
    setError('')
    try {
      const month = currentMonthKey()
      const incomeValue = Math.round(Number(income)) || 0
      await updateBudget(month, INCOME_CATEGORY, { assigned: String(incomeValue), rolled_over: '0' })

      for (const g of selectedGroups) {
        await addGroup(label(g)).catch(ignoreConflict)
      }

      let categoryCount = 0
      const items = liveCats()
      for (const g of selectedGroups) {
        const groupLabel = label(g)
        const rows = (cats[g.id] ?? []).filter((c) => c.on && c.name.trim())
        for (const c of rows) {
          await addCategory(label(c), groupLabel).catch(ignoreConflict)
          categoryCount += 1
        }
      }

      for (const item of items) {
        const catLabel = `${item.emoji} ${item.name.trim()}`
        await updateBudget(month, catLabel, { assigned: String(amounts[item.key] ?? 0), rolled_over: '0' })
      }

      await updateUser({ onboardedAt: new Date().toISOString() })
      await qc.invalidateQueries()
      // signalOnboarded() is deferred to the celebration screen's CTA — firing
      // it here would flip the root layout's guard and swap this screen out
      // before the user has seen step 5.

      setResult({ income: incomeValue, groupCount: selectedGroups.length, categoryCount, assigned: assignedTotal() })
      setStep(5)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setPending(false)
    }
  }

  const next = () => {
    if (!canAdvance) return
    if (step === 3) {
      setAmounts((prev) => (Object.keys(prev).length ? prev : distribute(true)))
      setStep(4)
      return
    }
    if (step === 4) {
      commit()
      return
    }
    setStep((s) => s + 1)
  }

  if (step === 5 && result) {
    return (
      <View style={[styles.container, { backgroundColor: tokens.bg, paddingTop: insets.top + 60, paddingBottom: insets.bottom + 20 }]}>
        <SetupDone
          income={result.income}
          groupCount={result.groupCount}
          categoryCount={result.categoryCount}
          assigned={result.assigned}
          onFinish={signalOnboarded}
        />
      </View>
    )
  }

  const [title, blurb] = TITLES[step]
  const rem = remainder()
  const hint =
    step === 1
      ? canAdvance
        ? ''
        : 'Enter an amount to continue'
      : step === 2
        ? canAdvance
          ? `${selectedGroups.length} groups selected`
          : 'Keep at least one group'
        : step === 3
          ? canAdvance
            ? `${selectedCatCount} categories across ${selectedGroups.length} groups`
            : 'Pick at least one category'
          : canAdvance
            ? 'Every rupee assigned'
            : rem > 0
              ? `${formatINR(rem)} still to assign`
              : `${formatINR(-rem)} over your income`

  const remColors = remainderColors(rem, tokens)
  const remLabel = rem === 0 ? 'All assigned' : rem < 0 ? 'Over by' : 'Left to assign'
  const activeCat = activeKey ? liveCats().find((c) => c.key === activeKey) : undefined

  return (
    <View style={[styles.container, { backgroundColor: tokens.bg, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.topRow}>
        <Pressable
          onPress={back}
          disabled={step === 1}
          style={[styles.backButton, { backgroundColor: tokens.card, borderColor: tokens.border, opacity: step === 1 ? 0.35 : 1 }]}
        >
          <ArrowLeft size={16} color={tokens.text} />
        </Pressable>
        <View style={styles.dots}>
          {[1, 2, 3, 4].map((n) => (
            <StepDot key={n} active={n <= step} activeColor={tokens.accent} inactiveColor={tokens.borderStrong} onPress={() => {}} />
          ))}
        </View>
        <Text style={[styles.stepCounter, { color: tokens.text3 }]}>step {step}/4</Text>
      </View>

      <Text style={[styles.title, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>{title}</Text>
      <Text style={[styles.blurb, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>{blurb}</Text>

      {step === 1 && (
        <View style={styles.stepBody}>
          <View style={styles.amountWrap}>
            <AmountTicker text={income ? formatINR(Number(income)) : '₹0'} tick={tick} dir={dir} delta={delta} dimmed={!income} />
          </View>
          <View style={styles.quickRow}>
            {QUICK_PICKS.map((v) => (
              <QuickPickChip key={v} label={formatINR(Number(v))} on={income === v} onPress={() => pickIncome(v)} />
            ))}
          </View>
          <View style={{ flex: 1, minHeight: 10 }} />
          <Numpad extraKey="00" onDigit={pressIncomeDigit} onBackspace={pressIncomeBackspace} />
        </View>
      )}

      {step === 2 && (
        <ScrollView style={styles.stepBody} contentContainerStyle={styles.rowList} showsVerticalScrollIndicator={false}>
          {groups.map((g) => (
            <PickRow
              key={g.id}
              emoji={g.emoji}
              name={g.name}
              on={g.on}
              placeholder="Group name"
              onCycleEmoji={() => patchGroup(g.id, { emoji: nextEmoji(g.emoji) })}
              onChangeName={(name) => patchGroup(g.id, { name })}
              onToggle={() => patchGroup(g.id, { on: !g.on })}
            />
          ))}
          <Pressable onPress={addGroupRow} style={[styles.addRow, { borderColor: tokens.borderStrong }]}>
            <Plus size={16} color={tokens.text2} strokeWidth={2.2} />
            <Text style={[styles.addRowLabel, { color: tokens.text2 }]}>Add your own group</Text>
          </Pressable>
          <Text style={[styles.microHint, { color: tokens.text3 }]}>tap a name to rename · tap the emoji to change it</Text>
        </ScrollView>
      )}

      {step === 3 && (
        <ScrollView style={styles.stepBody} contentContainerStyle={styles.sectionList} showsVerticalScrollIndicator={false}>
          {selectedGroups.map((g) => {
            const rows = cats[g.id] ?? []
            return (
              <View key={g.id} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={{ fontSize: 14 }}>{g.emoji}</Text>
                  <Text style={[styles.sectionTitle, { color: tokens.text3 }]}>{g.name.toUpperCase()}</Text>
                  <Text style={[styles.sectionCount, { color: tokens.text3 }]}>{rows.filter((c) => c.on).length} picked</Text>
                </View>
                {rows.map((c) => (
                  <PickRow
                    key={c.id}
                    emoji={c.emoji}
                    name={c.name}
                    on={c.on}
                    placeholder="Category name"
                    onCycleEmoji={() => patchCat(g.id, c.id, { emoji: nextEmoji(c.emoji) })}
                    onChangeName={(name) => patchCat(g.id, c.id, { name })}
                    onToggle={() => patchCat(g.id, c.id, { on: !c.on })}
                  />
                ))}
                <Pressable onPress={() => addCatRow(g.id)} style={[styles.addPill, { borderColor: tokens.borderStrong }]}>
                  <Plus size={14} color={tokens.text2} strokeWidth={2.4} />
                  <Text style={[styles.addPillLabel, { color: tokens.text2 }]}>Add category</Text>
                </Pressable>
              </View>
            )
          })}
          {selectedCatCount > 0 && (
            <Text style={[styles.microHint, { color: tokens.text3 }]}>
              🔔 alerts at {DEFAULT_ALERT_PCTS.join(' · ')}% by default — change any category&apos;s later in Envelopes
            </Text>
          )}
        </ScrollView>
      )}

      {step === 4 && (
        <View style={styles.stepBody}>
          <View style={[styles.remChip, { backgroundColor: remColors.bg, borderColor: remColors.color }]}>
            <Text style={[styles.remLabel, { color: remColors.color }]}>{remLabel}</Text>
            <Text style={[styles.remValue, { color: remColors.color, fontFamily: fontFamily.displaySemiBold }]}>
              {formatINR(Math.abs(rem))}
            </Text>
          </View>
          <View style={styles.splitRow}>
            <Pressable
              onPress={() => setAmounts(distribute(true))}
              style={[styles.splitButton, { borderColor: tokens.borderStrong, backgroundColor: tokens.inputBg }]}
            >
              <Text style={[styles.splitButtonLabel, { color: tokens.text2 }]}>Suggested split</Text>
            </Pressable>
            <Pressable
              onPress={() => setAmounts(distribute(false))}
              style={[styles.splitButton, { borderColor: tokens.borderStrong, backgroundColor: tokens.inputBg }]}
            >
              <Text style={[styles.splitButtonLabel, { color: tokens.text2 }]}>Split evenly</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sectionList} showsVerticalScrollIndicator={false}>
            {selectedGroups.map((g) => {
              const rows = (cats[g.id] ?? []).filter((c) => c.on && c.name.trim())
              const subtotal = rows.reduce((n, c) => n + (amounts[`${g.id}:${c.id}`] ?? 0), 0)
              return (
                <View key={g.id} style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={{ fontSize: 14 }}>{g.emoji}</Text>
                    <Text style={[styles.sectionTitle, { color: tokens.text3 }]}>{g.name.toUpperCase()}</Text>
                    <Text style={[styles.sectionSubtotal, { color: tokens.text2, fontFamily: fontFamily.displaySemiBold }]}>
                      {formatINR(subtotal)}
                    </Text>
                  </View>
                  {rows.map((c) => {
                    const key = `${g.id}:${c.id}`
                    const v = amounts[key] ?? 0
                    const active = activeKey === key
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => openRow(key)}
                        style={[
                          styles.assignRow,
                          { backgroundColor: active ? tokens.accentSoft : tokens.card, borderColor: active ? tokens.accent : tokens.border },
                        ]}
                      >
                        <View style={[styles.assignEmoji, { backgroundColor: tokens.inputBg, borderColor: tokens.border }]}>
                          <Text style={{ fontSize: 17 }}>{c.emoji}</Text>
                        </View>
                        <Text style={[styles.assignName, { color: tokens.text, fontFamily: fontFamily.bodyBold }]} numberOfLines={1}>
                          {c.name}
                        </Text>
                        <Text style={[styles.assignAmount, { color: v ? tokens.text : tokens.text3, fontFamily: fontFamily.displaySemiBold }]}>
                          {formatINR(v)}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              )
            })}
          </ScrollView>
        </View>
      )}

      {error !== '' && <Text style={[styles.errorText, { color: tokens.coral }]}>{error}</Text>}

      <Pressable
        onPress={next}
        disabled={!canAdvance || pending}
        style={[styles.cta, { backgroundColor: canAdvance ? tokens.accent : tokens.inputBg, opacity: pending ? 0.7 : 1 }]}
      >
        <Text style={[styles.ctaText, { color: canAdvance ? tokens.onAccent : tokens.text3, fontFamily: fontFamily.displaySemiBold }]}>
          {pending ? 'Saving…' : step === 4 ? 'Finish setup' : 'Continue'}
        </Text>
      </Pressable>
      {error === '' && <Text style={[styles.ctaHint, { color: tokens.text3 }]}>{hint}</Text>}

      <BottomSheet visible={!!activeKey} onClose={closeRow}>
        {activeCat && (
          <View style={{ gap: 12 }}>
            <View style={[styles.sheetGrabber, { backgroundColor: tokens.borderStrong }]} />
            <View style={styles.sheetHeader}>
              <View style={[styles.sheetEmoji, { backgroundColor: tokens.inputBg, borderColor: tokens.border }]}>
                <Text style={{ fontSize: 16 }}>{activeCat.emoji}</Text>
              </View>
              <Text style={[styles.sheetName, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]} numberOfLines={1}>
                {activeCat.name}
              </Text>
              <View style={[styles.remChipSmall, { backgroundColor: remColors.bg, borderColor: remColors.color }]}>
                <Text style={[styles.remLabelSmall, { color: remColors.color }]}>{remLabel}</Text>
                <Text style={[styles.remValueSmall, { color: remColors.color, fontFamily: fontFamily.displaySemiBold }]}>
                  {formatINR(Math.abs(rem))}
                </Text>
              </View>
            </View>
            <Text style={[styles.sheetAmount, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
              {formatINR(amounts[activeCat.key] ?? 0)}
            </Text>
            {rem !== 0 && (
              <Pressable onPress={fillRemainder} style={[styles.fillButton, { borderColor: tokens.accent, backgroundColor: tokens.accentSoft }]}>
                <Text style={[styles.fillButtonLabel, { color: tokens.accentInk }]}>Give this the leftover</Text>
              </Pressable>
            )}
            <Numpad extraKey="00" onDigit={pressAmt} onBackspace={() => pressAmt('del')} />
            <Pressable onPress={closeRow} style={[styles.sheetDone, { backgroundColor: tokens.accent }]}>
              <Text style={[styles.sheetDoneLabel, { color: tokens.onAccent, fontFamily: fontFamily.displaySemiBold }]}>Done</Text>
            </Pressable>
          </View>
        )}
      </BottomSheet>
    </View>
  )
}

// SetupWizard.dc.html:505-511 — the selected chip bounces (pillPop) and picks
// up a accent shadow instead of a flat border/background swap.
function QuickPickChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { tokens } = useTheme()
  const scale = useSharedValue(1)

  const onPressWithBounce = () => {
    onPress()
    scale.value = withSequence(withTiming(1.11, { duration: 143 }), withTiming(1.04, { duration: 197 }))
  }

  const style = useAnimatedStyle(() => ({ transform: [{ scale: on ? scale.value : 1 }] }))

  return (
    <Animated.View
      style={[
        style,
        on && { shadowColor: tokens.accent, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
      ]}
    >
      <Pressable
        onPress={onPressWithBounce}
        style={[
          styles.quickPick,
          { borderColor: on ? tokens.accent : tokens.borderStrong, backgroundColor: on ? tokens.accentSoft : tokens.inputBg },
        ]}
      >
        <Text style={[styles.quickPickLabel, { color: on ? tokens.accent : tokens.text2 }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 22 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 6, flex: 1 },
  stepCounter: { fontSize: 10 },
  title: { fontSize: 27, fontWeight: '600', lineHeight: 31, marginTop: 16, letterSpacing: -0.2 },
  blurb: { fontSize: 14, lineHeight: 21, marginTop: 7, maxWidth: 310 },
  stepBody: { flex: 1, marginTop: 4 },
  amountWrap: { paddingVertical: 20 },
  quickRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
  quickPick: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 100, borderWidth: 1 },
  quickPickLabel: { fontSize: 12, fontWeight: '700' },
  rowList: { gap: 8, paddingTop: 12 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed' },
  addRowLabel: { fontSize: 13, fontWeight: '700' },
  microHint: { fontSize: 10, paddingHorizontal: 4, paddingTop: 2 },
  sectionList: { gap: 16, paddingTop: 12 },
  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 11, letterSpacing: 1, flex: 1 },
  sectionCount: { fontSize: 11 },
  sectionSubtotal: { fontSize: 13 },
  addPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 100, borderWidth: 1, borderStyle: 'dashed' },
  addPillLabel: { fontSize: 12, fontWeight: '700' },
  errorText: { fontSize: 13, textAlign: 'center', marginTop: 8 },
  cta: { marginTop: 12, minHeight: 54, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 15 },
  ctaHint: { fontSize: 11, textAlign: 'center', marginTop: 8, minHeight: 15 },

  remChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 12, paddingHorizontal: 15, borderRadius: 16, borderWidth: 1 },
  remLabel: { fontSize: 12, fontWeight: '800' },
  remValue: { fontSize: 20 },
  splitRow: { flexDirection: 'row', gap: 7, marginTop: 10 },
  splitButton: { flex: 1, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 100, borderWidth: 1, alignItems: 'center' },
  splitButtonLabel: { fontSize: 12, fontWeight: '700' },
  assignRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, paddingHorizontal: 13, borderRadius: 18, borderWidth: 1.5 },
  assignEmoji: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  assignName: { flex: 1, fontSize: 14 },
  assignAmount: { fontSize: 15 },

  sheetGrabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 100 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetEmoji: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sheetName: { flex: 1, fontSize: 16 },
  remChipSmall: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1 },
  remLabelSmall: { fontSize: 10, fontWeight: '800' },
  remValueSmall: { fontSize: 13 },
  sheetAmount: { fontSize: 38, textAlign: 'center', letterSpacing: -0.4, paddingVertical: 4 },
  fillButton: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 100, borderWidth: 1 },
  fillButtonLabel: { fontSize: 12, fontWeight: '700' },
  sheetDone: { minHeight: 50, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  sheetDoneLabel: { fontSize: 15 },
})
