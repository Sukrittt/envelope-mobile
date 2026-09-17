import { useCurrency } from '@/src/context/CurrencyContext'
import { CheckIcon } from "@/src/components/shared/CheckIcon";
import { AmountText } from "@/src/components/ui/AmountText";
import { Numpad } from "@/src/components/ui/Numpad";
import { useAmountEntry } from "@/src/components/ui/useAmountEntry";
import { usePrivacy } from "@/src/context/PrivacyContext";
import { useBudgets, useUpdateBudget } from "@/src/hooks/useBudgets";
import { useCategories } from "@/src/hooks/useCategories";
import { useExpenses } from "@/src/hooks/useExpenses";
import { useGroups } from "@/src/hooks/useGroups";
import { EMPTY } from "@/src/lib/constants";
import {
  computeEnvelopeState,
  currentMonthKey,
  incomeForReadyToAssign,
  INCOME_CATEGORY,
  monthLabel,
} from "@/src/lib/envelope";

import { fontFamily } from "@/src/theme/fonts";
import { useTheme } from "@/src/theme/ThemeProvider";
import { useRouter } from "expo-router";
import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Reanimated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Opened by tapping Home's Ready to Assign hero. Categories carry last month's
 * assignments forward, so when income changes the user types the RTA they
 * actually have and we back out this month's income from it. Same layout as
 * edit-assigned-amount.tsx. */
export default function EditReadyToAssignModal() {
  const { tokens } = useTheme();
  const budgetsQ = useBudgets();
  const expensesQ = useExpenses();
  const categoriesQ = useCategories();
  const groupsQ = useGroups();

  if (
    budgetsQ.isLoading ||
    expensesQ.isLoading ||
    categoriesQ.isLoading ||
    groupsQ.isLoading
  ) {
    return (
      <View
        style={[
          styles.container,
          styles.center,
          { backgroundColor: tokens.bg },
        ]}
      >
        <ActivityIndicator color={tokens.accentInk} />
      </View>
    );
  }

  const month = currentMonthKey();
  const state = computeEnvelopeState(
    budgetsQ.data ?? EMPTY,
    expensesQ.data ?? EMPTY,
    month,
    categoriesQ.data ?? EMPTY,
    groupsQ.data ?? EMPTY,
  );

  // Mounted only once data has settled, so the numpad seeds from the real RTA.
  return (
    <EditReadyToAssignBody
      month={month}
      income={state.income}
      totalAssigned={state.totalAssigned}
      readyToAssign={state.readyToAssign}
    />
  );
}

function EditReadyToAssignBody({
  month,
  income,
  totalAssigned,
  readyToAssign,
}: {
  month: string;
  income: number;
  totalAssigned: number;
  readyToAssign: number;
}) {
  const { formatCurrency, formatAmountInput } = useCurrency()

  const { tokens, space, radius, type } = useTheme();
  const { hideAmounts } = usePrivacy();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const updateBudget = useUpdateBudget();

  // The numpad has no minus key, so an over-assigned month starts from 0.
  const {
    amount: amountText,
    setAmount: setAmountText,
    pushDigit,
    handleBackspace,
    shake,
  } = useAmountEntry(String(Math.max(0, readyToAssign)));
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const value = Number(amountText) || 0;
  const newIncome = incomeForReadyToAssign(totalAssigned, value);
  const delta = Math.round((newIncome - income) * 100) / 100;
  const impactText =
    delta === 0
      ? "Type what's left to assign"
      : `Income ${formatCurrency(newIncome, hideAmounts)}`;

  async function submit() {
    setSaving(true);
    setError("");
    try {
      // PUT upserts, so this creates the month's income row when it's still carried from last month.
      await updateBudget.mutateAsync({
        month,
        category: INCOME_CATEGORY,
        updates: { assigned: String(newIncome) },
      });
      setSuccess(true);
    } catch {
      setError("Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  // Let the inline checkmark finish drawing before navigating back.
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => router.back(), 1100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success]);

  return (
    <View style={[styles.container, { backgroundColor: tokens.bg }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + space.sm,
            paddingHorizontal: space.lg,
            gap: space.md,
            borderBottomColor: tokens.border,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => router.back()}
          hitSlop={12}
          style={[
            styles.headerBtn,
            {
              backgroundColor: tokens.card,
              borderColor: tokens.border,
              borderRadius: radius.full,
            },
          ]}
        >
          <X size={16} color={tokens.text} />
        </Pressable>
        <Text
          style={[
            styles.headerTitle,
            {
              color: tokens.text,
              fontFamily: fontFamily.displaySemiBold,
              fontSize: type.body,
            },
          ]}
        >
          Edit Ready to Assign
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: space.lg,
          paddingTop: space.lg,
          gap: space.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          style={[
            styles.stepLabel,
            {
              color: tokens.text3,
              fontFamily: fontFamily.bodySemiBold,
              fontSize: type.micro,
            },
          ]}
        >
          {monthLabel(month).toUpperCase()}
        </Text>
        {/* Mirrors move-money.tsx's DestinationCard so the top half isn't empty. */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: tokens.card,
              borderColor: tokens.border,
              borderRadius: radius.lg,
              padding: space.md,
              gap: space.md,
            },
          ]}
        >
          <View
            style={[
              styles.cardIcon,
              { backgroundColor: tokens.accentSoft, borderRadius: radius.md },
            ]}
          >
            <Text style={{ fontSize: type.title }}>💰</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={[
                styles.stepLabel,
                {
                  color: tokens.text3,
                  fontFamily: fontFamily.bodySemiBold,
                  fontSize: type.micro,
                },
              ]}
            >
              EDITING
            </Text>
            <Text
              style={{
                color: tokens.text,
                fontFamily: fontFamily.displaySemiBold,
                fontSize: type.body,
              }}
            >
              Ready to Assign
            </Text>
            <Text
              style={{
                color: tokens.text2,
                fontFamily: fontFamily.bodyMedium,
                fontSize: type.caption,
              }}
            >
              {formatCurrency(income, hideAmounts)} income ·{" "}
              {formatCurrency(totalAssigned, hideAmounts)} assigned
            </Text>
          </View>
        </View>

        <View style={[styles.amountWrap, { gap: space.sm }]}>
          <Animated.View
            style={{
              transform: [
                {
                  translateX: shake.interpolate({
                    inputRange: [-1, 1],
                    outputRange: [-8, 8],
                  }),
                },
              ],
            }}
          >
            <AmountText
              value={value}
              rawText={formatAmountInput(amountText)}
              size={type.hero}
              weight="displayBold"
              animate
              ignoreHide
            />
          </Animated.View>
          <Reanimated.Text
            key={impactText}
            entering={FadeIn.duration(150)}
            style={{
              color: tokens.text2,
              fontSize: type.caption,
              fontFamily: fontFamily.bodyMedium,
              textAlign: "center",
            }}
          >
            {impactText}
          </Reanimated.Text>
        </View>

        {error !== "" && (
          <Text style={{ color: tokens.coral, fontSize: 12 }}>{error}</Text>
        )}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: space.lg,
          paddingTop: space.sm,
          paddingBottom: insets.bottom + space.sm,
          gap: space.md,
        }}
      >
        <Numpad
          extraKey="."
          onDigit={pushDigit}
          onBackspace={handleBackspace}
          onClear={() => setAmountText("")}
          disabled={saving || success}
        />
        <Pressable
          style={[
            styles.confirmButton,
            {
              backgroundColor: success ? tokens.mint : tokens.accent,
              borderRadius: radius.full,
              opacity: saving ? 0.5 : 1,
            },
          ]}
          onPress={submit}
          disabled={saving || success}
        >
          {success ? (
            <CheckIcon color={tokens.onAccent} size={16} />
          ) : (
            <Text
              style={{
                color: tokens.onAccent,
                fontFamily: fontFamily.bodyBold,
                fontSize: type.body,
              }}
            >
              {saving ? "Saving…" : "Save"}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { flex: 1, textAlign: "right" },
  stepLabel: { letterSpacing: 0.6 },
  card: { flexDirection: "row", alignItems: "center", borderWidth: 1 },
  cardIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  amountWrap: { alignItems: "center", paddingVertical: 8 },
  confirmButton: { paddingVertical: 15, alignItems: "center", justifyContent: "center" },
});
