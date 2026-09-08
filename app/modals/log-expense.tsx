import { suggestCategoryLLM } from "@/src/api/categoryMap";
import { CategoryPickerSheet } from "@/src/components/shared/CategoryPickerSheet";
import { DatePicker } from "@/src/components/shared/DatePicker";
import { BottomSheet } from "@/src/components/shared/Modal";
import { AmountText } from "@/src/components/ui/AmountText";
import { Chip } from "@/src/components/ui/Chip";
import { Numpad } from "@/src/components/ui/Numpad";
import { useAmountEntry } from '@/src/components/ui/useAmountEntry';
import {
EMPTY_SUBMIT,
useLogExpenseSubmitPublisher,
} from "@/src/features/log-expense/SubmitContext";
import { useAddCategory,useCategories } from "@/src/hooks/useCategories";
import { useCategoryMap } from "@/src/hooks/useCategoryMap";
import {
useAddExpense,
useUpdateExpense,
} from "@/src/hooks/useExpenses";
import { todayIST } from "@/src/lib/date";
import { categoryEmoji,splitEmoji } from "@/src/lib/emoji";
import { formatAmountInput } from "@/src/lib/format";
import { useOnline } from "@/src/lib/netStatus";
import { useTheme } from "@/src/theme/ThemeProvider";
import { fontFamily } from "@/src/theme/fonts";
import { NAV_HEIGHT } from "@/src/theme/scale";
import { useLocalSearchParams,useRouter } from "expo-router";
import { ChevronDown } from "lucide-react-native";
import { useCallback,useEffect,useMemo,useRef,useState } from "react";
import {
Animated,
Pressable,
ScrollView,
StyleSheet,
Text,
TextInput,
View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function str(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

// Subset of Web's autoCategory.ts::suggestCategory — matches item words against
// the category-map dictionary. Skips the fuzzy old-category-name fallback since
// that's for renamed-category migration, not relevant when logging a new expense.
function suggestCategory(
  item: string,
  words: Record<string, string>,
  categories: string[],
): string {
  if (!item.trim()) return "";
  const matched = new Map<string, number>();
  for (const word of item.toLowerCase().split(/\s+/)) {
    if (word.length < 2) continue;
    const cat = words[word];
    if (cat && categories.includes(cat))
      matched.set(cat, (matched.get(cat) ?? 0) + 1);
  }
  let best = "";
  let bestScore = 0;
  for (const [cat, score] of matched) {
    if (score > bestScore) {
      best = cat;
      bestScore = score;
    }
  }
  return best;
}

/**
 * The app's primary verb, as a full-bleed accent screen rather than a form:
 * amount first on a custom keypad, description second, category picked from a
 * recently-used rail. Date, payment method and notes all have good defaults and
 * live behind the "More" disclosure, so the common path stays three inputs.
 *
 * Route-param driven: Activity passes {id, timestamp, item, amountInr, category,
 * date, notes, paymentMethod} of an existing row to enter edit mode. No params →
 * a fresh entry. Edit reuses this screen rather than a second form; the keypad
 * starts on the existing amount and backspaces from there.
 */
export default function LogExpenseScreen() {
  const { tokens, space, radius, type } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const online = useOnline();

  const origId = str(params.id) || undefined;
  const origTimestamp = str(params.timestamp);
  const isEdit = origTimestamp !== "";
  const origItem = str(params.item);
  const origAmountInr = Number(params.amountInr) || 0;

  const categoriesQ = useCategories();
  const categoryMapQ = useCategoryMap();
  const addExpense = useAddExpense();
  const updateExpense = useUpdateExpense();
  const addCategory = useAddCategory();

  const publishLogExpenseSubmit = useLogExpenseSubmitPublisher();
  const addMutate = addExpense.mutate;
  const updateMutate = updateExpense.mutate;
  const categories = useMemo(() => categoriesQ.data ?? [], [categoriesQ.data]);

  const [newCategoryName, setNewCategoryName] = useState("");
  const { amount, setAmount, pushDigit, handleBackspace, shake } = useAmountEntry(origAmountInr ? String(origAmountInr) : "", { shakeAtZero: true });
  const [item, setItem] = useState(origItem);
  const [category, setCategory] = useState(str(params.category));
  const [categoryTouched, setCategoryTouched] = useState(
    str(params.category) !== "",
  );
  const [date, setDate] = useState(str(params.date).slice(0, 10) || todayIST());
  const [notes, setNotes] = useState(str(params.notes));
  const [paymentMethod, setPaymentMethod] = useState<"bank" | "credit_card">(
    str(params.paymentMethod) === "credit_card" ? "credit_card" : "bank",
  );
  const [error, setError] = useState("");
  const [logSuccess, setLogSuccess] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Set only by a successful add (never an edit) right before setLogSuccess —
  // the effect below reads it to tell the two cases apart.
  const pendingAddNavRef = useRef<null | {
    pathname: "/modals/expense-added";
    params: Record<string, string>;
  }>(null);


  // Debounced auto-suggest while typing the description, only until the user
  // manually picks a category (so we never fight a deliberate choice).
  useEffect(() => {
    if (categoryTouched || !item.trim() || !categoryMapQ.data) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      const categoryNames = categories.map((c) => c.name);
      const suggested = suggestCategory(
        item,
        categoryMapQ.data!.words,
        categoryNames,
      );
      if (suggested) {
        setCategory(suggested);
        return;
      }
      // No local match — fall back to the LLM suggestion endpoint.
      suggestCategoryLLM(item, categoryNames).then((llmSuggested) => {
        if (cancelled || !llmSuggested) return;
        setCategory(llmSuggested);
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [item, categoryMapQ.data, categories, categoryTouched]);

  const selectedCategory = categories.find((c) => c.name === category);

  const parsedAmount = Number(amount);
  const canSubmit =
    item.trim() !== "" &&
    category !== "" &&
    !Number.isNaN(parsedAmount) &&
    parsedAmount > 0;
  const saving = addExpense.isPending || updateExpense.isPending;

  // Edit: let the inline checkmark finish drawing before navigating back
  // (1100ms, same beat CheckIcon uses elsewhere). Add: let the nav circle's
  // save animation (ripple -> tick, ~950ms) finish before replacing this
  // screen with the success screen — pendingAddNavRef, set right before
  // setLogSuccess(true) in the add branch below, tells the two apart.
  useEffect(() => {
    if (!logSuccess) return;
    const pending = pendingAddNavRef.current;
    const timer = setTimeout(
      () => (pending ? router.replace(pending) : router.back()),
      pending ? 950 : 1100,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logSuccess]);

  function handleCreateCategory() {
    const name = newCategoryName.trim();
    if (!name || addCategory.isPending) return;
    setError("");
    addCategory.mutate(
      { name, group: categories.length === 0 ? "Miscellaneous" : undefined },
      {
        onSuccess: () => {
          setCategory(name);
          setCategoryTouched(true);
          setNewCategoryName("");
        },
        onError: (e) => {
          const msg = e instanceof Error ? e.message : "";
          setError(
            msg.includes("already exists")
              ? "That name is already taken. Try a different name."
              : "Failed to add category",
          );
        },
      },
    );
  }

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    setError("");
    if (isEdit) {
      updateMutate(
        {
          id: origId,
          timestamp: origTimestamp,
          item: origItem,
          amountInr: origAmountInr,
          updates: {
            new_item: item.trim(),
            new_amount_inr: String(parsedAmount),
            new_date: date,
            category,
          },
        },
        {
          onSuccess: () => setLogSuccess(true),
          onError: () =>
            setError("Could not save. Check your connection and try again."),
        },
      );
    } else {
      addMutate(
        {
          item: item.trim(),
          amount_inr: String(parsedAmount),
          category,
          date,
          notes: notes.trim(),
          payment_method: paymentMethod,
        },
        {
          // replace, not push: this screen is spent, and Done on the success
          // screen should land on home with nothing stale behind it. `id` and
          // `timestamp` come back from the POST so Undo can address the row.
          // The replace itself is deferred: stash it and flip logSuccess so
          // the nav circle's save animation plays first (see the effect above).
          onSuccess: (res) => {
            pendingAddNavRef.current = {
              pathname: "/modals/expense-added",
              params: {
                id: res.id ?? "",
                clientId: res.clientId,
                pending: res.pending ? "1" : "",
                timestamp: res.timestamp ?? "",
                // Display fallback for servers that return no timestamp — the
                // success screen's stamp line would otherwise be blank.
                loggedAt: new Date().toISOString(),
                item: item.trim(),
                amount: String(parsedAmount),
                category,
                date,
                notes: notes.trim(),
                paymentMethod,
              },
            };
            setLogSuccess(true);
          },
          // A failed *add* gets its own screen, same as a successful one — the
          // inline error line below is easy to miss on the flood screen, and it
          // offers no next action. replace for the same reason as onSuccess:
          // this form entry is spent, and Dismiss replaces a fresh one back in
          // with these values prefilled.
          onError: () =>
            router.replace({
              pathname: "/modals/expense-failed",
              params: {
                item: item.trim(),
                amount: String(parsedAmount),
                category,
                date,
                notes: notes.trim(),
                paymentMethod,
              },
            }),
        },
      );
    }
  }, [canSubmit, isEdit, origId, origTimestamp, origItem, origAmountInr, item, parsedAmount, date, category, notes, paymentMethod, router, addMutate, updateMutate]);

  // Publish only when the action or its visible state changes.
  useEffect(() => {
    publishLogExpenseSubmit({
      canSubmit,
      saving,
      success: logSuccess,
      submit: handleSubmit,
    });
  }, [canSubmit, saving, logSuccess, handleSubmit, publishLogExpenseSubmit]);
  useEffect(() => () => publishLogExpenseSubmit(EMPTY_SUBMIT), [publishLogExpenseSubmit]);

  const onAccentDim = "rgba(255, 255, 255, 0.7)";
  const fieldBg = "rgba(255, 255, 255, 0.16)";

  return (
    <View style={[styles.screen, { backgroundColor: tokens.accent }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + space.sm, paddingHorizontal: space.lg },
        ]}
      >
        <Text
          style={[
            styles.headerTitle,
            {
              color: "#ffffff",
              fontFamily: fontFamily.displaySemiBold,
              fontSize: type.bodyLg,
              flex: 1,
              textAlign: "center",
            },
          ]}
        >
          {isEdit ? "Edit expense" : "Log expense"}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.body,
          { paddingHorizontal: space.lg, gap: space.lg, flexGrow: 1 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
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
              value={parsedAmount || 0}
              rawText={formatAmountInput(amount)}
              size={type.hero * 1.3}
              color={amount === "" ? onAccentDim : "#ffffff"}
              weight="displayBold"
              animate
              ignoreHide
            />
          </Animated.View>

          <Pressable
            onPress={() => setShowMore(true)}
            style={[styles.moreToggle, { gap: space.xs }]}
            hitSlop={8}
          >
            <Text
              style={[
                styles.moreLabel,
                {
                  color: onAccentDim,
                  fontFamily: fontFamily.bodySemiBold,
                  fontSize: type.caption,
                },
              ]}
            >
              More
            </Text>
            <ChevronDown size={16} color={onAccentDim} />
          </Pressable>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingHorizontal: space.lg,
            paddingBottom: NAV_HEIGHT + insets.bottom + space.lg,
            gap: space.md,
          },
        ]}
      >
        {error !== "" && (
          <Text
            style={[
              styles.error,
              { color: tokens.onAccent, fontFamily: fontFamily.bodySemiBold },
            ]}
          >
            {error}
          </Text>
        )}

        <View style={styles.itemRow}>
          <TextInput
            value={item}
            onChangeText={setItem}
            placeholder="What was it for?"
            placeholderTextColor={onAccentDim}
            style={[
              styles.itemInput,
              styles.itemInputWithPill,
              {
                backgroundColor: fieldBg,
                borderRadius: radius.md,
                color: "#ffffff",
                fontFamily: fontFamily.bodySemiBold,
                fontSize: type.bodyLg,
              },
            ]}
          />
          <Pressable
            onPress={() => setPickerOpen(true)}
            style={[
              styles.categoryPill,
              {
                backgroundColor: "rgba(255, 255, 255, 0.3)",
                borderRadius: radius.full,
              },
            ]}
          >
            {selectedCategory ? (
              <>
                {/* Separate Text node, no custom fontFamily: a ZWJ+variation-selector
                    emoji sharing one custom-font Text run with the label can make
                    Android silently drop the rest of that run. */}
                <Text style={{ color: tokens.onAccent, fontSize: type.caption }}>
                  {categoryEmoji(selectedCategory.name, selectedCategory.group)}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.categoryPillText,
                    {
                      flexShrink: 1,
                      marginLeft: space.xs,
                      color: tokens.onAccent,
                      fontFamily: fontFamily.bodySemiBold,
                    },
                  ]}
                >
                  {splitEmoji(selectedCategory.name).text}
                </Text>
              </>
            ) : (
              <Text
                style={[
                  styles.categoryPillText,
                  {
                    color: tokens.onAccent,
                    fontFamily: fontFamily.bodySemiBold,
                  },
                ]}
              >
                Category
              </Text>
            )}
          </Pressable>
        </View>

        <Numpad
          onAccent
          onDigit={pushDigit}
          onBackspace={handleBackspace}
          onClear={() => setAmount("")}
          extraKey="."
        />
      </View>

      <CategoryPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        value={category}
        onSelect={(c) => {
          setCategory(c);
          setCategoryTouched(true);
        }}
        title="Choose a category"
        noneLabel="No category"
        footer={
          <>
            {categories.length === 0 && !online && (
              <Text
                style={[
                  styles.fieldLabel,
                  {
                    color: tokens.text3,
                    fontFamily: fontFamily.bodyMedium,
                    marginTop: space.md,
                  },
                ]}
              >
                You can add categories once you&apos;re back online.
              </Text>
            )}
            {categories.length === 0 && online && (
              <View
                style={{
                  flexDirection: "row",
                  gap: space.sm,
                  marginTop: space.md,
                }}
              >
                <TextInput
                  value={newCategoryName}
                  onChangeText={setNewCategoryName}
                  placeholder="New category name"
                  placeholderTextColor={tokens.text3}
                  onSubmitEditing={handleCreateCategory}
                  style={[
                    styles.itemInput,
                    {
                      flex: 1,
                      backgroundColor: tokens.inputBg,
                      borderRadius: radius.md,
                      color: tokens.text,
                      fontFamily: fontFamily.bodyMedium,
                      fontSize: type.body,
                    },
                  ]}
                />
                <Pressable
                  onPress={handleCreateCategory}
                  disabled={!newCategoryName.trim() || addCategory.isPending}
                  style={[
                    styles.addCategory,
                    {
                      backgroundColor: tokens.accentInk,
                      borderRadius: radius.md,
                      opacity:
                        !newCategoryName.trim() || addCategory.isPending ? 0.5 : 1,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: tokens.onAccent,
                      fontFamily: fontFamily.bodySemiBold,
                      fontSize: type.caption,
                    }}
                  >
                    Add
                  </Text>
                </Pressable>
              </View>
            )}
          </>
        }
      />

      <BottomSheet visible={showMore} onClose={() => setShowMore(false)}>
        <Text
          style={[
            styles.sheetTitle,
            {
              color: tokens.text,
              fontFamily: fontFamily.displaySemiBold,
              fontSize: type.bodyLg,
            },
          ]}
        >
          More details
        </Text>

        <View style={{ gap: space.lg }}>
          <DatePicker mode="single" value={date} onChange={setDate} />

          <View style={{ gap: space.sm }}>
            <Text
              style={[
                styles.fieldLabel,
                { color: tokens.text3, fontFamily: fontFamily.bodySemiBold },
              ]}
            >
              Payment Method
            </Text>
            <View style={{ flexDirection: "row", gap: space.sm }}>
              {(["bank", "credit_card"] as const).map((m) => (
                <Chip
                  key={m}
                  selected={paymentMethod === m}
                  label={m === "bank" ? "Bank/UPI" : "Credit Card"}
                  onPress={() => setPaymentMethod(m)}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: space.sm }}>
            <Text
              style={[
                styles.fieldLabel,
                { color: tokens.text3, fontFamily: fontFamily.bodySemiBold },
              ]}
            >
              Notes (optional)
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Notes"
              placeholderTextColor={tokens.text3}
              style={[
                styles.itemInput,
                {
                  backgroundColor: tokens.inputBg,
                  borderRadius: radius.md,
                  color: tokens.text,
                  fontFamily: fontFamily.bodyMedium,
                  fontSize: type.body,
                },
              ]}
            />
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
  },
  headerTitle: {},
  scroll: { flex: 1 },
  body: { paddingTop: 8 },
  footer: {},
  amountWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  itemRow: { justifyContent: "center" },
  itemInput: { paddingHorizontal: 14, paddingVertical: 14 },
  itemInputWithPill: { paddingRight: 110 },
  categoryPill: {
    position: "absolute",
    right: 6,
    maxWidth: 108,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  categoryPillText: { fontSize: 12 },
  fieldLabel: { fontSize: 12 },
  error: { fontSize: 12, textAlign: "center" },
  moreToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  moreLabel: {},
  sheetTitle: { marginBottom: 12 },
  sheetList: { maxHeight: 320 },
  sheetChips: { flexDirection: "row", flexWrap: "wrap" },
  addCategory: {
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
