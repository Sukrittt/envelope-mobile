import { useEffect, useMemo, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
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
  computeEnvelopeState,
  currentMonthKey,
  monthLabel,
  prevMonthKey,
  shiftMonthKey,
} from "@/src/lib/envelope";
import { formatCurrency } from "@/src/lib/format";
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
import { SubscriptionsPanel } from "@/src/components/subscriptions/SubscriptionsPanel";
import { monthRange, weekRange, categoryBreakdown, withDelta, leftoverFor } from "@/src/lib/monthly";

function weekStartKey(dateStr: string): string {
  const d = new Date(dateStr);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatDrillRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) => `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()}–${e.getDate()} ${SHORT_MONTHS[e.getMonth()]}`;
  }
  return `${fmt(s)} – ${fmt(e)}`;
}

type DrillFilter = {
  start: string;
  end: string;
  parentView: "monthly" | "weekly";
} | null;

/** Month stepper shared by the Daily spend and Where it went cards below it. */
function MonthStepper({
  month,
  currentMonth,
  onShift,
}: {
  month: string;
  currentMonth: string;
  onShift: (delta: number) => void;
}) {
  const { tokens, space, radius, type } = useTheme();
  const canGoNext = month < currentMonth;
  return (
    <View style={[styles.monthNav, { gap: space.md }]}>
      <Pressable
        onPress={() => onShift(-1)}
        hitSlop={8}
        accessibilityLabel="Previous month"
        style={[styles.monthNavBtn, { backgroundColor: tokens.accentSoft, borderRadius: radius.full }]}
      >
        <Text style={[styles.monthNavGlyph, { color: tokens.text2, fontSize: type.body, lineHeight: type.body }]}>‹</Text>
      </Pressable>
      <Text style={{ color: tokens.text, fontSize: type.caption, fontFamily: fontFamily.bodySemiBold }}>
        {monthLabel(month)}
      </Text>
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
        <Text style={[styles.monthNavGlyph, { color: canGoNext ? tokens.text2 : tokens.text3, fontSize: type.body, lineHeight: type.body }]}>
          ›
        </Text>
      </Pressable>
    </View>
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

  const [chartVariant, setChartVariant] = useState<"area" | "bar">("area");
  const chartVariantKey = "mc-insights-chart-variant";
  const chartVariantHydrated = useRef(false);
  useEffect(() => {
    SecureStore.getItemAsync(chartVariantKey)
      .then((raw) => {
        if (raw === "area" || raw === "bar") setChartVariant(raw);
      })
      .catch(() => {})
      .finally(() => {
        chartVariantHydrated.current = true;
      });
  }, []);
  useEffect(() => {
    if (!chartVariantHydrated.current) return;
    SecureStore.setItemAsync(chartVariantKey, chartVariant).catch(() => {});
  }, [chartVariant]);
  const [trendPeriod, setTrendPeriod] = useState<
    "daily" | "weekly" | "monthly"
  >("weekly");
  const [drillFilter, setDrillFilter] = useState<DrillFilter>(null);
  const [insightMonth, setInsightMonth] = useState(() => currentMonthKey());
  const [breakdownMode, setBreakdownMode] = useState<"category" | "group">("category");

  const month = currentMonthKey();

  const envelopeState = useMemo(
    () => computeEnvelopeState(budgets, expenses, month, categories, groups),
    [budgets, expenses, month, categories, groups],
  );
  const creditCardEnvelope = envelopeState.envelopes.find(
    (e) => e.isCreditCardPayment,
  );

  const trendData: TrendPoint[] = useMemo(() => {
    const source = drillFilter
      ? expenses.filter(
          (e) => e.date >= drillFilter.start && e.date <= drillFilter.end,
        )
      : expenses;

    if (trendPeriod === "weekly") {
      const totals = new Map<string, number>();
      for (const e of source) {
        const key = weekStartKey(e.date);
        totals.set(key, (totals.get(key) ?? 0) + (Number(e.amount_inr) || 0));
      }
      const weeks = [...totals.keys()].sort();
      const trimmed = drillFilter ? weeks : weeks.slice(-10);
      return trimmed.map((date) => ({ date, value: totals.get(date) ?? 0 }));
    }
    if (trendPeriod === "monthly") {
      const totals = new Map<string, number>();
      for (const e of source) {
        const key = e.date.slice(0, 7);
        totals.set(key, (totals.get(key) ?? 0) + (Number(e.amount_inr) || 0));
      }
      const months = [...totals.keys()].sort().slice(-6);
      return months.map((date) => ({ date, value: totals.get(date) ?? 0 }));
    }
    const totals = new Map<string, number>();
    for (const e of source) {
      totals.set(
        e.date,
        (totals.get(e.date) ?? 0) + (Number(e.amount_inr) || 0),
      );
    }
    if (drillFilter) {
      // Fill every day in the drilled week, including zero-spend days, so the chart isn't sparse.
      const dates: string[] = [];
      const cursor = new Date(drillFilter.start);
      const end = new Date(drillFilter.end);
      while (cursor <= end) {
        dates.push(cursor.toISOString().slice(0, 10));
        cursor.setDate(cursor.getDate() + 1);
      }
      return dates.map((date) => ({ date, value: totals.get(date) ?? 0 }));
    }
    const dates = [...totals.keys()].sort().slice(-14);
    return dates.map((date) => ({ date, value: totals.get(date) ?? 0 }));
  }, [expenses, trendPeriod, drillFilter]);

  function selectTrendPeriod(p: "daily" | "weekly" | "monthly") {
    setTrendPeriod(p);
    setDrillFilter(null);
  }

  function handleTrendDrill(index: number) {
    const key = trendData[index]?.date;
    if (!key) return;
    if (trendPeriod === "monthly") {
      setDrillFilter({ ...monthRange(key), parentView: "monthly" });
      setTrendPeriod("weekly");
    } else if (trendPeriod === "weekly") {
      setDrillFilter({ ...weekRange(key), parentView: "weekly" });
      setTrendPeriod("daily");
    }
  }

  const heatmapCells: HeatmapCell[] = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of expenses) {
      if (!e.date.startsWith(insightMonth)) continue;
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
    return cells;
  }, [expenses, insightMonth]);

  const todayIso = todayIST();

  const insightText = useMemo(() => {
    const overspent = envelopeState.envelopes
      .filter((e) => e.isOverspent && !e.isCreditCardPayment)
      .sort((a, b) => a.available - b.available);
    if (overspent.length > 0) {
      return `${overspent[0].category} is overspent by ${formatCurrency(Math.abs(overspent[0].available), hideAmounts)}, the biggest drag this month.`;
    }
    if (creditCardEnvelope && creditCardEnvelope.available > 0) {
      return `Credit card payment of ${formatCurrency(creditCardEnvelope.available, hideAmounts)} is set aside and ready to pay.`;
    }
    const withBudget = envelopeState.envelopes.filter(
      (e) => !e.isCreditCardPayment && e.assigned > 0,
    );
    if (withBudget.length > 0) {
      const low = [...withBudget].sort((a, b) => a.available - b.available)[0];
      return `${low.category} has ${formatCurrency(low.available, hideAmounts)} left. Keep an eye on it.`;
    }
    return "No spending data yet this month.";
  }, [envelopeState, creditCardEnvelope, hideAmounts]);

  const prevBreakdownRows = useMemo(
    () => categoryBreakdown(budgets, expenses, categories, groups, prevMonthKey(insightMonth), breakdownMode),
    [budgets, expenses, categories, groups, insightMonth, breakdownMode],
  );
  const breakdownRows = useMemo(() => {
    const rows = categoryBreakdown(budgets, expenses, categories, groups, insightMonth, breakdownMode);
    return withDelta(rows, prevBreakdownRows);
  }, [budgets, expenses, categories, groups, insightMonth, breakdownMode, prevBreakdownRows]);

  const breakdownTotalSpent = useMemo(() => breakdownRows.reduce((s, r) => s + r.spent, 0), [breakdownRows]);
  const breakdownTotalDeltaPct = useMemo(() => {
    const prevTotal = prevBreakdownRows.reduce((s, r) => s + r.spent, 0);
    return prevTotal > 0 ? ((breakdownTotalSpent - prevTotal) / prevTotal) * 100 : null;
  }, [prevBreakdownRows, breakdownTotalSpent]);

  const insightMonthLeftover = useMemo(
    () => leftoverFor(budgets, expenses, categories, groups, insightMonth),
    [budgets, expenses, categories, groups, insightMonth],
  );

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
      contentContainerStyle={{ gap: space.lg }}
    >
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
            Spending trend
          </Text>
          <View
            style={[
              styles.toggleGroup,
              { backgroundColor: tokens.inputBg, borderRadius: radius.full },
            ]}
          >
            <Pressable
              accessibilityLabel="Area chart"
              onPress={() => setChartVariant("area")}
              style={[
                styles.toggleBtn,
                { borderRadius: radius.full },
                chartVariant === "area" && {
                  backgroundColor: tokens.chipActiveBg,
                },
              ]}
            >
              <Text style={{ color: tokens.text, fontSize: type.caption }}>
                〜
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Bar chart"
              onPress={() => setChartVariant("bar")}
              style={[
                styles.toggleBtn,
                { borderRadius: radius.full },
                chartVariant === "bar" && {
                  backgroundColor: tokens.chipActiveBg,
                },
              ]}
            >
              <Text style={{ color: tokens.text, fontSize: type.caption }}>
                ▊▍
              </Text>
            </Pressable>
          </View>
        </View>

        <View
          style={[
            styles.periodToggle,
            {
              backgroundColor: tokens.inputBg,
              borderRadius: radius.full,
              marginTop: space.md,
            },
          ]}
        >
          {(["daily", "weekly", "monthly"] as const).map((p) => (
            <Pressable
              key={p}
              onPress={() => selectTrendPeriod(p)}
              style={[
                styles.periodBtn,
                { borderRadius: radius.full },
                trendPeriod === p && { backgroundColor: tokens.chipActiveBg },
              ]}
            >
              <Text
                style={{
                  color: tokens.text,
                  fontSize: type.caption,
                  fontFamily:
                    trendPeriod === p
                      ? fontFamily.bodyBold
                      : fontFamily.bodyMedium,
                }}
              >
                {p[0].toUpperCase() + p.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {drillFilter && (
          <Pressable
            style={{ marginTop: space.sm, alignSelf: "flex-start" }}
            onPress={() => {
              setTrendPeriod(drillFilter.parentView);
              setDrillFilter(null);
            }}
          >
            <Text
              style={{
                color: tokens.accentInk,
                fontSize: type.caption,
                fontFamily: fontFamily.bodySemiBold,
              }}
            >
              ‹ {formatDrillRange(drillFilter.start, drillFilter.end)}
            </Text>
          </Pressable>
        )}

        <TrendChart
          data={trendData}
          variant={chartVariant}
          hideAmounts={hideAmounts}
          onSelectIndex={trendPeriod !== "daily" ? handleTrendDrill : undefined}
        />
      </Card>

      <MonthStepper
        month={insightMonth}
        currentMonth={month}
        onShift={(delta) => setInsightMonth((m) => shiftMonthKey(m, delta))}
      />

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
            totalSpent={breakdownTotalSpent}
            totalDeltaPct={breakdownTotalDeltaPct}
            mode={breakdownMode}
            onModeChange={setBreakdownMode}
            leftover={insightMonthLeftover}
            monthLabel={monthLabel(insightMonth)}
          />
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
          Daily spend
        </Text>
        <View style={{ marginTop: space.md }}>
          <Heatmap
            cells={heatmapCells}
            todayDate={todayIso}
            onSelectDate={(date) =>
              router.push({ pathname: "/(tabs)/activity", params: { date } })
            }
          />
        </View>
        <Text
          style={{
            color: tokens.text2,
            fontSize: type.caption,
            marginTop: space.md,
            fontFamily: fontFamily.bodyMedium,
          }}
        >
          {insightText}
        </Text>
      </Card>

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
  },
  cardTitle: {},
  toggleGroup: { flexDirection: "row", gap: 2, padding: 3 },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  periodToggle: { flexDirection: "row", gap: 2, padding: 3 },
  periodBtn: { flex: 1, paddingVertical: 8, alignItems: "center" },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
  monthNavBtn: {
    width: 20,
    height: 20,
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
