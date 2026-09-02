import { useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { ArrowLeft, Plus } from "lucide-react-native";
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
  monthLabel,
  prevMonthKey,
  shiftMonthKey,
} from "@/src/lib/envelope";
import { formatDateShort } from "@/src/lib/format";
import { todayIST } from "@/src/lib/date";
import { EMPTY } from "@/src/lib/constants";
import { Screen } from "@/src/components/ui/Screen";
import { Card } from "@/src/components/ui/Card";
import { IconButton } from "@/src/components/ui/Button";
import {
  TrendChart,
  type TrendPoint,
} from "@/src/components/charts/TrendChart";
import { Heatmap, type HeatmapCell } from "@/src/components/charts/Heatmap";
import { CategoryBreakdown } from "@/src/components/charts/CategoryBreakdown";
import { ComparisonLine } from "@/src/components/insights/ComparisonLine";
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

/** Month control for the whole screen: bounded stepper, a partial-month
 *  chip, a reset to the current month, and a horizontal swipe. Rendered as
 *  the Screen's sticky subheader, outside the ScrollView, so it never
 *  scrolls out of view — every card below reads off this one control. */
function MonthStepper({
  month,
  currentMonth,
  earliestMonth,
  onShift,
  onReset,
}: {
  month: string;
  currentMonth: string;
  earliestMonth: string;
  onShift: (delta: number) => void;
  onReset: () => void;
}) {
  const { tokens, space, radius, type } = useTheme();
  const canGoPrev = month > earliestMonth;
  const canGoNext = month < currentMonth;
  const isCurrent = month === currentMonth;

  const swipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      if (e.translationX < -20 && canGoNext) onShift(1);
      else if (e.translationX > 20 && canGoPrev) onShift(-1);
    });

  return (
    <GestureDetector gesture={swipe}>
      <View style={[styles.monthNav, { gap: space.md }]}>
        <Pressable
          onPress={() => canGoPrev && onShift(-1)}
          disabled={!canGoPrev}
          hitSlop={8}
          accessibilityLabel="Previous month"
          style={[
            styles.monthNavBtn,
            { borderRadius: radius.full },
            canGoPrev ? { backgroundColor: tokens.accentSoft } : { backgroundColor: tokens.border },
          ]}
        >
          <Text style={[styles.monthNavGlyph, { color: canGoPrev ? tokens.text2 : tokens.text3, fontSize: type.bodyLg, lineHeight: type.bodyLg }]}>
            ‹
          </Text>
        </Pressable>

        <View style={styles.monthNavCenter}>
          <View style={styles.monthNavLabelRow}>
            <Text style={{ color: tokens.text, fontSize: type.body, fontFamily: fontFamily.bodySemiBold }}>
              {monthLabel(month)}
            </Text>
            {isCurrent && (
              <View style={[styles.soFarChip, { backgroundColor: tokens.chipActiveBg, borderRadius: radius.full }]}>
                <Text style={{ color: tokens.text2, fontSize: 10, fontFamily: fontFamily.bodySemiBold }}>so far</Text>
              </View>
            )}
          </View>
          {!isCurrent && (
            <Pressable onPress={onReset} hitSlop={6}>
              <Text style={{ color: tokens.accentInk, fontSize: 11, fontFamily: fontFamily.bodySemiBold }}>This month</Text>
            </Pressable>
          )}
        </View>

        <Pressable
          onPress={() => canGoNext && onShift(1)}
          disabled={!canGoNext}
          hitSlop={8}
          accessibilityLabel="Next month"
          style={[
            styles.monthNavBtn,
            { borderRadius: radius.full },
            canGoNext ? { backgroundColor: tokens.accentSoft } : { backgroundColor: tokens.border },
          ]}
        >
          <Text style={[styles.monthNavGlyph, { color: canGoNext ? tokens.text2 : tokens.text3, fontSize: type.bodyLg, lineHeight: type.bodyLg }]}>
            ›
          </Text>
        </Pressable>
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

  const budgets = useBudgets().data ?? EMPTY;
  const expenses = useExpenses().data ?? EMPTY;
  const categories = useCategories().data ?? EMPTY;
  const groups = useGroups().data ?? EMPTY;
  const { data: subscriptions = [], isLoading: subscriptionsLoading } =
    useSubscriptions();

  const month = currentMonthKey();
  const todayIso = todayIST();

  const [insightMonth, setInsightMonth] = useState(() => currentMonthKey());
  const [breakdownMode, setBreakdownMode] = useState<"category" | "group">("category");
  const [variableOnly, setVariableOnly] = useState(false);
  const [selectedBreakdownKey, setSelectedBreakdownKey] = useState<string | null>(null);
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
    () => Array.from({ length: TREND_MONTHS }, (_, i) => shiftMonthKey(month, i - (TREND_MONTHS - 1))),
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

  const comparison = useMemo(
    () => monthComparison(expenses, insightMonth, todayIso),
    [expenses, insightMonth, todayIso],
  );

  const fixedCategorySet = useMemo(
    () => fixedCategories(expenses, insightMonth),
    [expenses, insightMonth],
  );

  const prevBreakdownRows = useMemo(
    () => categoryBreakdown(budgets, expenses, categories, groups, prevMonthKey(insightMonth), breakdownMode),
    [budgets, expenses, categories, groups, insightMonth, breakdownMode],
  );
  const breakdownRows = useMemo(() => {
    const rows = categoryBreakdown(budgets, expenses, categories, groups, insightMonth, breakdownMode);
    return withDelta(rows, prevBreakdownRows);
  }, [budgets, expenses, categories, groups, insightMonth, breakdownMode, prevBreakdownRows]);

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
        totals.set(e.date, (totals.get(e.date) ?? 0) + (Number(e.amount_inr) || 0));
      }
      const [y, m] = insightMonth.split("-").map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      const firstWeekday = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday = 0
      const cells: HeatmapCell[] = [];
      for (let i = 0; i < firstWeekday; i++) cells.push({ date: `pad-${i}`, day: 0, value: 0 });
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
      days.push({ date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, day: d });
      cursor.setDate(cursor.getDate() + 1);
    }
    const startDate = days[0]?.date ?? todayIso;
    for (const e of expenses) {
      if (e.date < startDate || e.date > todayIso) continue;
      if (!matchesSelection(e.category)) continue;
      totals.set(e.date, (totals.get(e.date) ?? 0) + (Number(e.amount_inr) || 0));
    }
    const firstWeekday = (start.getDay() + 6) % 7;
    const cells: HeatmapCell[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push({ date: `pad-${i}`, day: 0, value: 0 });
    for (const day of days) cells.push({ date: day.date, day: day.day, value: totals.get(day.date) ?? 0 });
    return { cells, caption: `${formatDateShort(startDate)} – ${formatDateShort(todayIso)}` };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matchesSelection closes over selectedBreakdownKey/breakdownMode/categoryGroupMap, already deps below
  }, [expenses, insightMonth, heatmapView, todayIso, selectedBreakdownKey, breakdownMode, categoryGroupMap]);

  const selectedBreakdownRow = breakdownRows.find((r) => r.key === selectedBreakdownKey) ?? null;
  const heatmapTitle = selectedBreakdownRow ? `Daily spend · ${selectedBreakdownRow.label}` : "Daily spend";

  return (
    <Screen
      title="Insights"
      floatingNav={false}
      actions={
        <IconButton
          icon={ArrowLeft}
          accessibilityLabel="Back"
          onPress={() => router.back()}
        />
      }
      subheader={
        <MonthStepper
          month={insightMonth}
          currentMonth={month}
          earliestMonth={earliestMonth}
          onShift={(delta) => setInsightMonth((m) => shiftMonthKey(m, delta))}
          onReset={() => setInsightMonth(month)}
        />
      }
      contentContainerStyle={{ gap: space.lg }}
    >
      <ComparisonLine comparison={comparison} monthLabel={monthLabel(insightMonth)} hideAmounts={hideAmounts} />

      <Card elevated={false} style={{ backgroundColor: tokens.card }}>
        <Text
          style={[
            styles.cardTitle,
            { color: tokens.text, fontFamily: fontFamily.displaySemiBold, fontSize: type.bodyLg },
          ]}
        >
          Spending trend
        </Text>
        <View style={{ marginTop: space.md }}>
          <TrendChart
            data={trendData}
            baseline={comparison.baseline ?? undefined}
            selectedKey={insightMonth}
            hideAmounts={hideAmounts}
            onSelect={(key) => setInsightMonth(key)}
          />
        </View>
      </Card>

      <Card elevated={false} style={{ backgroundColor: tokens.card }}>
        <Text
          style={[
            styles.cardTitle,
            { color: tokens.text, fontFamily: fontFamily.displaySemiBold, fontSize: type.bodyLg },
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
              { color: tokens.text, fontFamily: fontFamily.displaySemiBold, fontSize: type.bodyLg },
            ]}
          >
            {heatmapTitle}
          </Text>
          <View style={[styles.toggleGroup, { backgroundColor: tokens.inputBg, borderRadius: radius.full }]}>
            <Pressable
              accessibilityLabel="This month"
              onPress={() => setHeatmapView("month")}
              style={[styles.toggleBtn, { borderRadius: radius.full }, heatmapView === "month" && { backgroundColor: tokens.chipActiveBg }]}
            >
              <Text style={{ color: tokens.text, fontSize: type.caption, fontFamily: fontFamily.bodyMedium }}>Month</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="12 weeks"
              onPress={() => setHeatmapView("weeks")}
              style={[styles.toggleBtn, { borderRadius: radius.full }, heatmapView === "weeks" && { backgroundColor: tokens.chipActiveBg }]}
            >
              <Text style={{ color: tokens.text, fontSize: type.caption, fontFamily: fontFamily.bodyMedium }}>12 weeks</Text>
            </Pressable>
          </View>
        </View>
        {heatmap.caption && (
          <Text style={{ color: tokens.text3, fontSize: 11, fontFamily: fontFamily.bodyMedium, marginTop: 2 }}>
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

      <Card elevated={false} style={{ backgroundColor: tokens.card }}>
        <View style={styles.headRow}>
          <Text
            style={[
              styles.cardTitle,
              { color: tokens.text, fontFamily: fontFamily.displaySemiBold, fontSize: type.bodyLg },
            ]}
          >
            Subscriptions
          </Text>
          <Pressable
            onPress={() => router.push("/modals/subscription")}
            style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}
            accessibilityLabel="Add subscription"
          >
            <Plus size={14} color={tokens.accentInk} />
            <Text style={{ color: tokens.accentInk, fontSize: type.caption, fontFamily: fontFamily.bodySemiBold }}>
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
  },
  cardTitle: {},
  toggleGroup: { flexDirection: "row", gap: 2, padding: 3 },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthNavCenter: { flex: 1, alignItems: "center", gap: 2 },
  monthNavLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  soFarChip: { paddingHorizontal: 8, paddingVertical: 2 },
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
