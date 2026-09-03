import { useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { ArrowLeft, Plus, Play } from "lucide-react-native";
import { useTheme } from "@/src/theme/ThemeProvider";
import { usePrivacy } from "@/src/context/PrivacyContext";
import { fontFamily } from "@/src/theme/fonts";
import { useBudgets } from "@/src/hooks/useBudgets";
import { useExpenses } from "@/src/hooks/useExpenses";
import { useCategories } from "@/src/hooks/useCategories";
import { useGroups } from "@/src/hooks/useGroups";
import { useSubscriptions } from "@/src/hooks/useSubscriptions";
import {
  currentMonthKey,
  monthAbbrev,
  monthLabel,
  prevMonthKey,
  shiftMonthKey,
} from "@/src/lib/envelope";
import { formatCurrency, formatDateShort } from "@/src/lib/format";
import { todayIST } from "@/src/lib/date";
import { EMPTY } from "@/src/lib/constants";
import { OfflineScreen } from "@/src/components/shared/OfflineScreen";
import { useOnline } from "@/src/lib/netStatus";
import { Screen } from "@/src/components/ui/Screen";
import { Card } from "@/src/components/ui/Card";
import { IconButton } from "@/src/components/ui/Button";
import {
  TrendChart,
  type TrendPoint,
} from "@/src/components/charts/TrendChart";
import { Heatmap, type HeatmapCell } from "@/src/components/charts/Heatmap";
import { CategoryBreakdown } from "@/src/components/charts/CategoryBreakdown";
import { SubscriptionsPanel } from "@/src/components/subscriptions/SubscriptionsPanel";
import {
  categoryBreakdown,
  withDelta,
  leftoverFor,
  monthTotals,
  monthComparison,
  fixedCategories,
} from "@/src/lib/monthly";

const TREND_MONTHS = 12;
const HEATMAP_WEEKS = 12;

/** Number of whole months `month` sits behind `currentMonth`. Both are
 *  "YYYY-MM" keys, so this is plain calendar-month arithmetic. */
function monthsBack(month: string, currentMonth: string): number {
  const [y1, m1] = month.split("-").map(Number);
  const [y2, m2] = currentMonth.split("-").map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

/** The screen's whole header: back arrow, the month itself as the title,
 *  a status/reset chip, and the bounded stepper — plus a horizontal swipe
 *  over the same row. Rendered as the Screen's sticky subheader, outside the
 *  ScrollView, so it never scrolls out of view. The period is the screen's
 *  identity, not the word "Insights" — so there's no separate title above
 *  this row, and this row owns the safe-area top inset itself. */
function MonthStepper({
  month,
  currentMonth,
  earliestMonth,
  onBack,
  onShift,
  onReset,
}: {
  month: string;
  currentMonth: string;
  earliestMonth: string;
  onBack: () => void;
  onShift: (delta: number) => void;
  onReset: () => void;
}) {
  const { tokens, space, radius, type } = useTheme();
  const insets = useSafeAreaInsets();
  const canGoPrev = month > earliestMonth;
  const canGoNext = month < currentMonth;
  const isCurrent = month === currentMonth;
  const back = monthsBack(month, currentMonth);

  const swipe = Gesture.Pan()
    .activeOffsetX([-60, 60])
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      if (e.translationX < -60 && canGoNext) onShift(1);
      else if (e.translationX > 60 && canGoPrev) onShift(-1);
    });

  return (
    <GestureDetector gesture={swipe}>
      <View
        style={[
          styles.monthNav,
          { gap: space.md, paddingTop: insets.top + space.md },
        ]}
      >
        <IconButton
          icon={ArrowLeft}
          accessibilityLabel="Back"
          onPress={onBack}
          size={36}
        />

        <View style={styles.monthNavCenter}>
          <Text
            numberOfLines={1}
            style={{
              color: tokens.text,
              fontSize: type.title,
              fontFamily: fontFamily.displaySemiBold,
              letterSpacing: -0.3,
            }}
          >
            {monthLabel(month)}
          </Text>
          {isCurrent ? null : (
            <View style={[styles.monthNavLabelRow, { marginTop: 4 }]}>
              <Text
                style={{
                  color: tokens.text3,
                  fontSize: 11,
                  fontFamily: fontFamily.bodyMedium,
                }}
              >
                {back} {back === 1 ? "month" : "months"} back
              </Text>
              <Pressable
                onPress={onReset}
                hitSlop={6}
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: tokens.accentSoft,
                    borderRadius: radius.full,
                  },
                ]}
              >
                <Text
                  style={{
                    color: tokens.accentInk,
                    fontSize: 11,
                    fontFamily: fontFamily.bodySemiBold,
                  }}
                >
                  ↩ Today
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={{ flexDirection: "row", gap: space.xs }}>
          <Pressable
            onPress={() => canGoPrev && onShift(-1)}
            disabled={!canGoPrev}
            accessibilityState={{ disabled: !canGoPrev }}
            hitSlop={8}
            accessibilityLabel="Previous month"
            style={[
              styles.monthNavBtn,
              { borderRadius: radius.full },
              canGoPrev
                ? { backgroundColor: tokens.accentSoft }
                : { backgroundColor: tokens.border },
            ]}
          >
            <Text
              style={[
                styles.monthNavGlyph,
                {
                  color: canGoPrev ? tokens.accentInk : tokens.text3,
                  fontSize: type.bodyLg,
                  lineHeight: type.bodyLg,
                },
              ]}
            >
              ‹
            </Text>
          </Pressable>
          <Pressable
            onPress={() => canGoNext && onShift(1)}
            disabled={!canGoNext}
            accessibilityState={{ disabled: !canGoNext }}
            hitSlop={8}
            accessibilityLabel="Next month"
            style={[
              styles.monthNavBtn,
              { borderRadius: radius.full },
              canGoNext
                ? { backgroundColor: tokens.accentSoft }
                : { backgroundColor: tokens.border },
            ]}
          >
            <Text
              style={[
                styles.monthNavGlyph,
                {
                  color: canGoNext ? tokens.accentInk : tokens.text3,
                  fontSize: type.bodyLg,
                  lineHeight: type.bodyLg,
                },
              ]}
            >
              ›
            </Text>
          </Pressable>
        </View>
      </View>
    </GestureDetector>
  );
}

/**
 * Everything that used to sit below the fold on Home: the spending trend, the
 * calendar heatmap and subscriptions. Home is the month's state; this is the
 * month's story, and separating them is what lets either be large.
 */
export default function InsightsScreen() {
  const { tokens, space, radius, type } = useTheme();
  const { hideAmounts } = usePrivacy();
  const router = useRouter();

  const online = useOnline();
  const budgets = useBudgets().data ?? EMPTY;
  const expenses = useExpenses().data ?? EMPTY;
  const categories = useCategories().data ?? EMPTY;
  const groups = useGroups().data ?? EMPTY;
  const { data: subscriptions = [], isLoading: subscriptionsLoading } =
    useSubscriptions();

  const month = currentMonthKey();
  const todayIso = todayIST();

  const [insightMonth, setInsightMonth] = useState(() => currentMonthKey());
  const [breakdownMode, setBreakdownMode] = useState<"category" | "group">(
    "category",
  );
  const [variableOnly, setVariableOnly] = useState(false);
  const [selectedBreakdownKey, setSelectedBreakdownKey] = useState<
    string | null
  >(null);
  const [heatmapView, setHeatmapView] = useState<"month" | "weeks">("month");

  // Reset the breakdown selection whenever what it points into changes shape,
  // rather than pointing at a row that no longer exists. Same render-time
  // ref-compare pattern the app already uses (e.g. Home's ready-to-assign sync).
  const breakdownScope = `${insightMonth}|${breakdownMode}|${variableOnly}`;
  const prevBreakdownScope = useRef(breakdownScope);
  if (prevBreakdownScope.current !== breakdownScope) {
    prevBreakdownScope.current = breakdownScope;
    if (selectedBreakdownKey != null) setSelectedBreakdownKey(null);
  }

  function handleModeChange(nextMode: "category" | "group") {
    setBreakdownMode(nextMode);
    if (nextMode === "group") setVariableOnly(false);
  }

  const earliestMonth = useMemo(() => {
    if (expenses.length === 0) return month;
    return expenses.reduce((min, e) => {
      const key = e.date.slice(0, 7);
      return key < min ? key : min;
    }, month);
  }, [expenses, month]);

  const categoryGroupMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) map.set(c.name, c.group || "");
    return map;
  }, [categories]);

  function matchesSelection(category: string): boolean {
    if (!selectedBreakdownKey) return true;
    if (breakdownMode === "category") return category === selectedBreakdownKey;
    return (categoryGroupMap.get(category) || "Other") === selectedBreakdownKey;
  }

  const trendMonths = useMemo(
    () =>
      Array.from({ length: TREND_MONTHS }, (_, i) =>
        shiftMonthKey(month, i - (TREND_MONTHS - 1)),
      ),
    [month],
  );
  const trendData: TrendPoint[] = useMemo(() => {
    const totals = monthTotals(expenses, trendMonths);
    // Months with nothing spent don't get a slot at all — a new user with
    // one month of data sees one bar, not eleven empty ones waiting to fill in.
    return trendMonths
      .map((m) => ({ date: m, value: totals.get(m) ?? 0 }))
      .filter((d) => d.value > 0);
  }, [expenses, trendMonths]);

  // With under 3 real data points a bar chart shows less than a sentence
  // would (two labelled bars against a ₹6k axis). Compare the selected month
  // against its predecessor directly instead of asking the chart to carry it.
  const trendSummary = useMemo(() => {
    if (trendData.length >= 3) return null;
    if (trendData.length <= 1) return { kind: "first" as const };
    const prevKey = prevMonthKey(insightMonth);
    const totals = monthTotals(expenses, [insightMonth, prevKey]);
    const curr = totals.get(insightMonth) ?? 0;
    const prev = totals.get(prevKey) ?? 0;
    const deltaPct = prev > 0 ? ((curr - prev) / prev) * 100 : null;
    return { kind: "compare" as const, curr, prev, prevKey, deltaPct };
  }, [trendData.length, expenses, insightMonth]);

  const comparison = useMemo(
    () => monthComparison(expenses, insightMonth, todayIso),
    [expenses, insightMonth, todayIso],
  );

  const fixedCategorySet = useMemo(
    () => fixedCategories(expenses, insightMonth),
    [expenses, insightMonth],
  );

  const prevBreakdownRows = useMemo(
    () =>
      categoryBreakdown(
        budgets,
        expenses,
        categories,
        groups,
        prevMonthKey(insightMonth),
        breakdownMode,
      ),
    [budgets, expenses, categories, groups, insightMonth, breakdownMode],
  );
  const breakdownRows = useMemo(() => {
    const rows = categoryBreakdown(
      budgets,
      expenses,
      categories,
      groups,
      insightMonth,
      breakdownMode,
    );
    return withDelta(rows, prevBreakdownRows);
  }, [
    budgets,
    expenses,
    categories,
    groups,
    insightMonth,
    breakdownMode,
    prevBreakdownRows,
  ]);

  const insightMonthLeftover = useMemo(
    () => leftoverFor(budgets, expenses, categories, groups, insightMonth),
    [budgets, expenses, categories, groups, insightMonth],
  );

  const heatmap = useMemo(() => {
    const totals = new Map<string, number>();
    if (heatmapView === "month") {
      for (const e of expenses) {
        if (!e.date.startsWith(insightMonth)) continue;
        if (!matchesSelection(e.category)) continue;
        totals.set(
          e.date,
          (totals.get(e.date) ?? 0) + (Number(e.amount_inr) || 0),
        );
      }
      const [y, m] = insightMonth.split("-").map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      const firstWeekday = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday = 0
      const cells: HeatmapCell[] = [];
      for (let i = 0; i < firstWeekday; i++)
        cells.push({ date: `pad-${i}`, day: 0, value: 0 });
      for (let d = 1; d <= daysInMonth; d++) {
        const date = `${insightMonth}-${String(d).padStart(2, "0")}`;
        cells.push({ date, day: d, value: totals.get(date) ?? 0 });
      }
      return { cells, caption: null as string | null };
    }

    const [ty, tm, td] = todayIso.split("-").map(Number);
    const end = new Date(ty, tm - 1, td);
    const start = new Date(end);
    start.setDate(start.getDate() - (HEATMAP_WEEKS * 7 - 1));
    const days: { date: string; day: number }[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth() + 1;
      const d = cursor.getDate();
      days.push({
        date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        day: d,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    const startDate = days[0]?.date ?? todayIso;
    for (const e of expenses) {
      if (e.date < startDate || e.date > todayIso) continue;
      if (!matchesSelection(e.category)) continue;
      totals.set(
        e.date,
        (totals.get(e.date) ?? 0) + (Number(e.amount_inr) || 0),
      );
    }
    const firstWeekday = (start.getDay() + 6) % 7;
    const cells: HeatmapCell[] = [];
    for (let i = 0; i < firstWeekday; i++)
      cells.push({ date: `pad-${i}`, day: 0, value: 0 });
    for (const day of days)
      cells.push({
        date: day.date,
        day: day.day,
        value: totals.get(day.date) ?? 0,
      });
    return {
      cells,
      caption: `${formatDateShort(startDate)} – ${formatDateShort(todayIso)}`,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matchesSelection closes over selectedBreakdownKey/breakdownMode/categoryGroupMap, already deps below
  }, [
    expenses,
    insightMonth,
    heatmapView,
    todayIso,
    selectedBreakdownKey,
    breakdownMode,
    categoryGroupMap,
  ]);

  const selectedBreakdownRow =
    breakdownRows.find((r) => r.key === selectedBreakdownKey) ?? null;
  const heatmapTitle = selectedBreakdownRow
    ? `Daily spend · ${selectedBreakdownRow.label}`
    : "Daily spend";

  if (!online) return <OfflineScreen />;

  return (
    <Screen
      floatingNav={false}
      subheader={
        <MonthStepper
          month={insightMonth}
          currentMonth={month}
          earliestMonth={earliestMonth}
          onBack={() => router.back()}
          onShift={(delta) => setInsightMonth((m) => shiftMonthKey(m, delta))}
          onReset={() => setInsightMonth(month)}
        />
      }
      contentContainerStyle={{ gap: space.lg }}
    >
      <Card elevated={false} style={{ backgroundColor: tokens.card, marginTop: space.sm }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <View>
            <Text
              style={[
                styles.cardTitle,
                {
                  color: tokens.text,
                  fontFamily: fontFamily.displaySemiBold,
                  fontSize: type.bodyLg,
                },
              ]}
            >
              Spending trend
            </Text>
            <Text
              style={{
                color: tokens.text3,
                fontSize: 11,
                fontFamily: fontFamily.bodyMedium,
                marginTop: 2,
              }}
            >
              Last 12 months
            </Text>
          </View>
          {trendSummary?.kind === "compare" &&
            trendSummary.deltaPct != null && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View
                  style={{
                    transform: [
                      { rotate: trendSummary.deltaPct > 0 ? "-90deg" : "90deg" },
                    ],
                  }}
                >
                  <Play
                    size={10}
                    color={trendSummary.deltaPct > 0 ? tokens.coral : tokens.mint}
                    fill={trendSummary.deltaPct > 0 ? tokens.coral : tokens.mint}
                  />
                </View>
                <Text
                  style={{
                    fontFamily: fontFamily.bodySemiBold,
                    fontSize: type.caption,
                    color: trendSummary.deltaPct > 0 ? tokens.coral : tokens.mint,
                  }}
                >
                  {Math.abs(trendSummary.deltaPct).toFixed(0)}%
                </Text>
              </View>
            )}
        </View>
        <View style={{ marginTop: space.md }}>
          {trendSummary ? (
            trendSummary.kind === "first" ? (
              <Text
                style={{
                  color: tokens.text2,
                  fontSize: type.body,
                  fontFamily: fontFamily.bodyMedium,
                }}
              >
                First month tracked.
              </Text>
            ) : (
              <Text
                style={{
                  color: tokens.text2,
                  fontSize: type.body,
                  fontFamily: fontFamily.bodyMedium,
                }}
              >
                <Text
                  style={{
                    color: tokens.text,
                    fontFamily: fontFamily.bodySemiBold,
                  }}
                >
                  {formatCurrency(trendSummary.curr, hideAmounts)}
                </Text>{" "}
                in {monthLabel(insightMonth)} vs{" "}
                {formatCurrency(trendSummary.prev, hideAmounts)} in{" "}
                {monthLabel(trendSummary.prevKey)}
              </Text>
            )
          ) : (
            <TrendChart
              data={trendData}
              baseline={comparison.baseline ?? undefined}
              selectedKey={insightMonth}
              hideAmounts={hideAmounts}
              onSelect={(key) => setInsightMonth(key)}
              partialKey={month}
              partialNote={`${monthAbbrev(month)}, ${Number(todayIso.slice(8, 10))} days in`}
            />
          )}
        </View>
      </Card>

      <Card elevated={false} style={{ backgroundColor: tokens.card }}>
        <Text
          style={[
            styles.cardTitle,
            {
              color: tokens.text,
              fontFamily: fontFamily.displaySemiBold,
              fontSize: type.bodyLg,
            },
          ]}
        >
          Where it went
        </Text>
        <View style={{ marginTop: space.md }}>
          <CategoryBreakdown
            rows={breakdownRows}
            mode={breakdownMode}
            onModeChange={handleModeChange}
            fixedCategories={fixedCategorySet}
            variableOnly={variableOnly}
            onToggleVariableOnly={() => setVariableOnly((v) => !v)}
            selectedKey={selectedBreakdownKey}
            onSelectKey={setSelectedBreakdownKey}
            comparison={comparison}
            leftover={insightMonthLeftover}
            monthLabel={monthLabel(insightMonth)}
          />
        </View>
      </Card>

      <Card elevated={false} style={{ backgroundColor: tokens.card }}>
        <View style={styles.headRow}>
          <Text
            style={[
              styles.cardTitle,
              styles.heatmapTitle,
              {
                color: tokens.text,
                fontFamily: fontFamily.displaySemiBold,
                fontSize: type.bodyLg,
              },
            ]}
          >
            {heatmapTitle}
          </Text>
          <View
            style={[
              styles.toggleGroup,
              { backgroundColor: tokens.inputBg, borderRadius: radius.full },
            ]}
          >
            <Pressable
              accessibilityLabel="This month"
              onPress={() => setHeatmapView("month")}
              style={[
                styles.toggleBtn,
                { borderRadius: radius.full },
                heatmapView === "month" && {
                  backgroundColor: tokens.chipActiveBg,
                },
              ]}
            >
              <Text
                style={{
                  color: tokens.text,
                  fontSize: type.caption,
                  fontFamily: fontFamily.bodyMedium,
                }}
              >
                Month
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="12 weeks"
              onPress={() => setHeatmapView("weeks")}
              style={[
                styles.toggleBtn,
                { borderRadius: radius.full },
                heatmapView === "weeks" && {
                  backgroundColor: tokens.chipActiveBg,
                },
              ]}
            >
              <Text
                style={{
                  color: tokens.text,
                  fontSize: type.caption,
                  fontFamily: fontFamily.bodyMedium,
                }}
              >
                12 weeks
              </Text>
            </Pressable>
          </View>
        </View>
        {heatmap.caption && (
          <Text
            style={{
              color: tokens.text3,
              fontSize: 11,
              fontFamily: fontFamily.bodyMedium,
              marginTop: 2,
            }}
          >
            {heatmap.caption}
          </Text>
        )}
        <View style={{ marginTop: space.md }}>
          <Heatmap
            cells={heatmap.cells}
            todayDate={todayIso}
            onSelectDate={(date) =>
              router.push({ pathname: "/(tabs)/activity", params: { date } })
            }
          />
        </View>
      </Card>

      <View style={styles.scopeDivider}>
        <View
          style={[styles.scopeDividerLine, { backgroundColor: tokens.border }]}
        />
        <Text
          style={{
            color: tokens.text3,
            fontSize: 11,
            fontFamily: fontFamily.bodyMedium,
            marginHorizontal: space.sm,
          }}
        >
          Not scoped to {monthLabel(insightMonth)}
        </Text>
        <View
          style={[styles.scopeDividerLine, { backgroundColor: tokens.border }]}
        />
      </View>

      <Card elevated={false} style={{ backgroundColor: tokens.card }}>
        <View style={styles.headRow}>
          <Text
            style={[
              styles.cardTitle,
              {
                color: tokens.text,
                fontFamily: fontFamily.displaySemiBold,
                fontSize: type.bodyLg,
              },
            ]}
          >
            Subscriptions
          </Text>
          <Pressable
            onPress={() => router.push("/modals/subscription")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space.xs,
            }}
            accessibilityLabel="Add subscription"
          >
            <Plus size={14} color={tokens.accentInk} />
            <Text
              style={{
                color: tokens.accentInk,
                fontSize: type.caption,
                fontFamily: fontFamily.bodySemiBold,
              }}
            >
              Add
            </Text>
          </Pressable>
        </View>
        <SubscriptionsPanel
          subscriptions={subscriptions}
          loading={subscriptionsLoading}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    rowGap: 6,
  },
  cardTitle: {},
  heatmapTitle: { flexShrink: 1, flexBasis: "60%", marginRight: 8 },
  scopeDivider: { flexDirection: "row", alignItems: "center" },
  scopeDividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  toggleGroup: { flexDirection: "row", gap: 2, padding: 3 },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  monthNav: { flexDirection: "row", alignItems: "flex-start" },
  monthNavCenter: { flex: 1 },
  monthNavLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  monthNavBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  monthNavGlyph: {
    textAlign: "center",
    includeFontPadding: false,
    textAlignVertical: "center",
    marginTop: -1,
  },
});
