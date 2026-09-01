import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import {
  ArrowLeft,
  Camera,
  Images,
  Plus,
  Trash2,
  Search,
  Check,
  type LucideIcon,
} from "lucide-react-native";
import { useTheme } from "@/src/theme/ThemeProvider";
import { fontFamily } from "@/src/theme/fonts";
import { useCategories } from "@/src/hooks/useCategories";
import { useScanBill } from "@/src/hooks/useScanBill";
import { useAddExpense } from "@/src/hooks/useExpenses";
import { categoryEmoji, splitEmoji } from "@/src/lib/emoji";
import { formatINR, formatDate } from "@/src/lib/format";
import {
  computeShare,
  feeDiff,
  groupByDivisor,
  isFeeLine,
  round2,
  type ScanItem,
} from "@/src/lib/split";
import { todayIST } from "@/src/lib/date";
import { LoadingCaption } from "@/src/components/shared/LoadingCaption";
import { BottomSheet } from "@/src/components/shared/Modal";
import { Card } from "@/src/components/ui/Card";
import { Chip } from "@/src/components/ui/Chip";
import { AmountText } from "@/src/components/ui/AmountText";
import { PopIn } from "@/src/components/shared/PopIn";
import {
  FILL_DELAY,
  FILL_DURATION,
} from "@/src/components/envelope/ProgressBar";
import type { ScanResult } from "@/src/api/scan";

type ReviewItem = ScanItem & { key: string; name: string };

type Phase = "picking" | "scanning" | "review" | "confirm" | "error";

const DIVISORS = [1, 2, 3, 4];
const PEOPLE_COUNTS = [2, 3, 4, 5];

// Reveal cascade for each phase's first paint — same shared-value-driven
// pattern and constants as money-brain.tsx/Heatmap.tsx, reused as-is.
const MOUNT_START_DELAY_MS = 100;
const BLOCK_STAGGER_MS = 90;
const ITEM_STAGGER_MS = 45;
const ITEM_STAGGER_CAP_INDEX = 6;

let nextKey = 0;
function makeKey(): string {
  nextKey += 1;
  return String(nextKey);
}

function itemsFrom(result: ScanResult): ReviewItem[] {
  return result.items.map((it) => ({
    key: makeKey(),
    name: it.name,
    price: it.price,
    divisor: 1,
  }));
}

function splitLabel(divisor: number | null): string {
  if (divisor === null) return "skip";
  if (divisor === 1) return "Mine";
  return `÷${divisor}`;
}

/**
 * Pick a Blinkit/Instamart cart screenshot or a restaurant-bill photo, let
 * Gemini extract merchant/total/items, then review + split before logging one
 * ordinary expense through the same useAddExpense path log-expense uses.
 *
 * Phases: 'picking' (source bottom sheet), 'scanning' (loading caption),
 * 'review' (editable line items + split + fee/people card), 'confirm' (a
 * read-only breakdown before logging), 'error' (scan failed, escape hatch to
 * a blank manual entry). Only the computed share, merchant, category and date
 * become the expense — line items and the fee split never leave this screen.
 */
export default function ScanBillScreen() {
  const { tokens, space, radius, type } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const categoriesQ = useCategories();
  const categories = useMemo(() => categoriesQ.data ?? [], [categoriesQ.data]);
  const scanBill = useScanBill();
  const addExpense = useAddExpense();

  const [phase, setPhase] = useState<Phase>("picking");
  const [errorMsg, setErrorMsg] = useState("");

  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(todayIST());
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [feeResidual, setFeeResidual] = useState(0);
  const [peopleCount, setPeopleCount] = useState(2);
  const [query, setQuery] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);

  const selectedCategory = categories.find((c) => c.name === category);
  const productItems = useMemo(
    () => items.filter((it) => !isFeeLine(it.name)),
    [items],
  );
  const feeItems = useMemo(
    () => items.filter((it) => isFeeLine(it.name)),
    [items],
  );
  const feeAggregate = useMemo(
    () => round2(feeItems.reduce((s, it) => s + it.price, 0) + feeResidual),
    [feeItems, feeResidual],
  );
  const hasFee = Math.abs(feeAggregate) >= 0.01;
  const feeShare = hasFee ? round2(feeAggregate / peopleCount) : 0;
  const billTotal = useMemo(
    () => round2(items.reduce((s, it) => s + it.price, 0) + feeResidual),
    [items, feeResidual],
  );
  const myShare = useMemo(
    () => round2(computeShare(productItems) + feeShare),
    [productItems, feeShare],
  );
  const sharePct = billTotal > 0 ? Math.round((myShare / billTotal) * 100) : 0;
  const buckets = useMemo(() => groupByDivisor(productItems), [productItems]);
  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? productItems.filter((it) => it.name.toLowerCase().includes(q))
      : productItems;
  }, [productItems, query]);
  const canProceed =
    merchant.trim() !== "" &&
    category !== "" &&
    myShare > 0 &&
    !addExpense.isPending;

  function updateItem(key: string, patch: Partial<ReviewItem>) {
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, ...patch } : it)),
    );
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }

  function addBlankItem() {
    setItems((prev) => [
      ...prev,
      { key: makeKey(), name: "", price: 0, divisor: 1 },
    ]);
  }

  function toggleSelecting() {
    setSelecting((prev) => !prev);
    setSelected([]);
  }

  function toggleSelected(key: string) {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function applyBulkDivisor(divisor: number) {
    if (selected.length === 0) return;
    setItems((prev) =>
      prev.map((it) => (selected.includes(it.key) ? { ...it, divisor } : it)),
    );
    setSelected([]);
    setSelecting(false);
  }

  function setAllMine() {
    setItems((prev) => prev.map((it) => ({ ...it, divisor: 1 })));
  }

  async function pickFrom(source: "camera" | "library") {
    Haptics.selectionAsync().catch(() => {});
    const perm =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setErrorMsg(
        "Camera/photo access is off — enable it in Settings, or enter this expense manually.",
      );
      setPhase("error");
      return;
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      quality: 0.5,
      base64: true,
    };
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    if (result.canceled || !result.assets?.[0]) {
      router.back();
      return;
    }

    const asset = result.assets[0];
    if (!asset.base64) {
      setErrorMsg(
        "Couldn't read that image — try again or enter this expense manually.",
      );
      setPhase("error");
      return;
    }
    // The scan route always requires a non-empty category list — guards the
    // case where categories are still loading (or there simply are none yet)
    // at the moment the picker resolves, rather than sending Gemini an empty
    // enum constraint and getting back a 400.
    if (categories.length === 0) {
      setErrorMsg(
        "No categories to sort this into yet — add one first, or enter this expense manually.",
      );
      setPhase("error");
      return;
    }

    setPhase("scanning");
    scanBill.mutate(
      {
        image: asset.base64,
        mimeType: asset.mimeType ?? "image/jpeg",
        categories: categories.map((c) => c.name),
      },
      {
        onSuccess: (res) => {
          setMerchant(res.merchant);
          setCategory(res.category ?? "");
          setDate(res.date ?? todayIST());
          setItems(itemsFrom(res));
          setFeeResidual(feeDiff(res.total, res.items));
          setPeopleCount(2);
          setQuery("");
          setSelecting(false);
          setSelected([]);
          setPhase("review");
        },
        onError: () => {
          setErrorMsg(
            "Couldn't read that bill — try a clearer photo, or enter this expense manually.",
          );
          setPhase("error");
        },
      },
    );
  }

  function handleConfirm() {
    if (addExpense.isPending) return;
    addExpense.mutate(
      {
        item: merchant.trim(),
        amount_inr: String(myShare),
        category,
        date,
        payment_method: "bank",
      },
      {
        onSuccess: (res) =>
          router.replace({
            pathname: "/modals/expense-added",
            params: {
              id: res.id ?? "",
              timestamp: res.timestamp ?? "",
              loggedAt: new Date().toISOString(),
              item: merchant.trim(),
              amount: String(myShare),
              category,
              date,
              notes: "",
              paymentMethod: "bank",
            },
          }),
        onError: () =>
          router.replace({
            pathname: "/modals/expense-failed",
            params: {
              item: merchant.trim(),
              amount: String(myShare),
              category,
              date,
              notes: "",
              paymentMethod: "bank",
            },
          }),
      },
    );
  }

  const categoryLabel = category ? splitEmoji(category).text : "";

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: tokens.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {phase === "confirm" ? (
        <ScreenHeader
          onLeft={() => setPhase("review")}
          leftIcon={ArrowLeft}
          title="Confirm your log"
        />
      ) : phase === "review" ? (
        <ScreenHeader
          title="Scan a bill"
          subtitle={`${productItems.length} ${productItems.length === 1 ? "item" : "items"} · scanned just now`}
          right={
            <Pressable
              onPress={toggleSelecting}
              style={[
                styles.selectToggle,
                {
                  borderRadius: radius.full,
                  borderColor: selecting ? tokens.accentInk : tokens.border,
                  backgroundColor: selecting
                    ? tokens.accentSoft
                    : tokens.inputBg,
                },
              ]}
            >
              <Text
                style={{
                  color: selecting ? tokens.accentInk : tokens.text2,
                  fontFamily: fontFamily.bodyBold,
                  fontSize: type.caption,
                }}
              >
                {selecting ? "Done" : "Select"}
              </Text>
            </Pressable>
          }
        />
      ) : (
        <ScreenHeader title="Scan a bill" />
      )}

      {phase === "scanning" && (
        <View style={[styles.centerFill, { marginTop: -50 }]}>
          <LoadingCaption
            phrases={[
              "Reading the bill…",
              "Finding the total…",
              "Spotting line items…",
              "Almost done…",
            ]}
          />
        </View>
      )}

      {phase === "error" && (
        <View
          style={[
            styles.centerFill,
            { paddingHorizontal: space.lg, gap: space.lg },
          ]}
        >
          <Text
            style={{
              color: tokens.text2,
              fontFamily: fontFamily.bodyMedium,
              fontSize: type.body,
              textAlign: "center",
            }}
          >
            {errorMsg}
          </Text>
          <Pressable
            onPress={() => router.replace("/modals/log-expense")}
            style={[
              styles.confirm,
              {
                backgroundColor: tokens.accent,
                borderRadius: radius.full,
                paddingVertical: space.md,
                paddingHorizontal: space.xl,
              },
            ]}
          >
            <Text
              style={{
                color: tokens.onAccent,
                fontFamily: fontFamily.bodyBold,
                fontSize: type.bodyLg,
              }}
            >
              Enter manually
            </Text>
          </Pressable>
        </View>
      )}

      {phase === "review" && (
        <>
          <View
            style={{
              paddingHorizontal: space.lg,
              paddingTop: 8,
              gap: space.md,
            }}
          >
            <PopIn play delay={MOUNT_START_DELAY_MS}>
              <Card elevated={false} style={{ gap: space.xs }}>
                <Text style={[styles.microLabel, { color: tokens.text3 }]}>
                  YOUR SHARE
                </Text>
                <AmountText
                  value={myShare}
                  size={type.display}
                  color={tokens.accentInk}
                  animate
                  ignoreHide
                />
                <View style={styles.spaceBetween}>
                  <View style={{ flex: 1 }}>
                    <RevealBar
                      pct={sharePct}
                      color={tokens.accent}
                      trackColor={tokens.borderStrong}
                      height={6}
                    />
                  </View>
                </View>
                <View style={styles.spaceBetween}>
                  <Text
                    style={{
                      color: tokens.text3,
                      fontFamily: fontFamily.bodySemiBold,
                      fontSize: type.caption,
                    }}
                  >
                    of {formatINR(billTotal)} bill
                  </Text>
                  <Text
                    style={{
                      color: tokens.text3,
                      fontFamily: fontFamily.bodyBold,
                      fontSize: type.caption,
                    }}
                  >
                    {sharePct}% yours
                  </Text>
                </View>
              </Card>
            </PopIn>

            <PopIn
              play
              delay={MOUNT_START_DELAY_MS + BLOCK_STAGGER_MS}
              style={[styles.row, { gap: space.sm }]}
            >
              <View
                style={[
                  styles.searchRow,
                  {
                    flex: 1,
                    gap: space.sm,
                    backgroundColor: tokens.inputBg,
                    borderColor: tokens.border,
                  },
                ]}
              >
                <Search size={16} color={tokens.text3} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search items"
                  placeholderTextColor={tokens.text3}
                  style={[
                    styles.searchInput,
                    {
                      color: tokens.text,
                      fontFamily: fontFamily.bodyMedium,
                      fontSize: type.body,
                    },
                  ]}
                />
                {query.length > 0 && (
                  <Pressable
                    onPress={() => setQuery("")}
                    style={[
                      styles.clearButton,
                      { backgroundColor: tokens.border },
                    ]}
                  >
                    <Text style={{ color: tokens.text2, fontSize: 11 }}>✕</Text>
                  </Pressable>
                )}
              </View>
              <Pressable
                onPress={setAllMine}
                style={[
                  styles.allMineButton,
                  {
                    backgroundColor: tokens.inputBg,
                    borderColor: tokens.border,
                    borderRadius: radius.md,
                  },
                ]}
              >
                <Text
                  style={{
                    color: tokens.text2,
                    fontFamily: fontFamily.bodyBold,
                    fontSize: type.caption,
                  }}
                >
                  All mine
                </Text>
              </Pressable>
            </PopIn>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.body,
              { paddingHorizontal: space.lg, gap: space.md },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            {visibleItems.length === 0 && items.length > 0 && (
              <Text
                style={{
                  color: tokens.text3,
                  fontFamily: fontFamily.bodyMedium,
                  fontSize: type.body,
                  textAlign: "center",
                  paddingVertical: space.lg,
                }}
              >
                No items match &quot;{query}&quot;
              </Text>
            )}

            {visibleItems.map((it, i) => {
              const isSelected = selected.includes(it.key);
              return (
                <PopIn
                  key={it.key}
                  play
                  delay={
                    MOUNT_START_DELAY_MS +
                    2 * BLOCK_STAGGER_MS +
                    Math.min(i, ITEM_STAGGER_CAP_INDEX) * ITEM_STAGGER_MS
                  }
                  style={[
                    styles.itemCard,
                    {
                      gap: space.sm,
                      backgroundColor: tokens.card,
                      borderRadius: radius.md,
                    },
                  ]}
                >
                  {selecting ? (
                    <Pressable
                      onPress={() => toggleSelected(it.key)}
                      style={[styles.row, { gap: space.sm }]}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          {
                            borderRadius: radius.sm,
                            borderColor: isSelected
                              ? tokens.accentInk
                              : tokens.border,
                            backgroundColor: isSelected
                              ? tokens.accentInk
                              : "transparent",
                          },
                        ]}
                      >
                        {isSelected && (
                          <Check
                            size={13}
                            color={tokens.onAccent}
                            strokeWidth={3}
                          />
                        )}
                      </View>
                      <Text
                        style={{
                          flex: 1,
                          color: tokens.text,
                          fontFamily: fontFamily.bodyBold,
                          fontSize: type.body,
                        }}
                        numberOfLines={1}
                      >
                        {it.name || "Item"}
                      </Text>
                      <Text
                        style={{
                          color: tokens.text2,
                          fontFamily: fontFamily.bodySemiBold,
                          fontSize: type.body,
                        }}
                      >
                        {formatINR(it.price)}
                      </Text>
                    </Pressable>
                  ) : (
                    <>
                      <View
                        style={[
                          styles.row,
                          { justifyContent: "space-between" },
                        ]}
                      >
                        <TextInput
                          value={it.name}
                          onChangeText={(v) => updateItem(it.key, { name: v })}
                          placeholder="Item"
                          placeholderTextColor={tokens.text3}
                          style={[
                            styles.itemNameInput,
                            {
                              flex: 1,
                              color: tokens.text,
                              fontFamily: fontFamily.bodyBold,
                              fontSize: type.body,
                            },
                          ]}
                        />
                        <TextInput
                          value={String(round2(it.price / (it.divisor || 1)))}
                          onChangeText={(v) => {
                            const enteredShare =
                              Number(v.replace(/[^0-9.]/g, "")) || 0;
                            updateItem(it.key, {
                              price: round2(enteredShare * (it.divisor || 1)),
                            });
                          }}
                          keyboardType="decimal-pad"
                          style={{
                            color: tokens.accentInk,
                            fontFamily: fontFamily.bodyBold,
                            fontSize: type.body,
                            padding: 0,
                            minWidth: 40,
                            textAlign: "right",
                          }}
                        />
                      </View>
                      <View
                        style={[
                          styles.row,
                          { justifyContent: "space-between" },
                        ]}
                      >
                        <View style={styles.row}>
                          <Text
                            style={{
                              color: tokens.text3,
                              fontFamily: fontFamily.bodySemiBold,
                              fontSize: type.caption,
                              marginRight: 6,
                            }}
                          >
                            ₹{it.price}
                          </Text>
                          <Text
                            style={{
                              color: tokens.text3,
                              fontFamily: fontFamily.bodySemiBold,
                              fontSize: type.caption,
                            }}
                          >
                            {it.divisor === 1
                              ? "· all yours"
                              : `· split ${it.divisor} ways`}
                          </Text>
                        </View>
                        <Text
                          style={[styles.microLabel, { color: tokens.text3 }]}
                        >
                          YOURS
                        </Text>
                      </View>
                      <View style={[styles.row, { gap: space.xs }]}>
                        {DIVISORS.map((d) => (
                          <Chip
                            key={d}
                            label={splitLabel(d)}
                            selected={it.divisor === d}
                            onPress={() => updateItem(it.key, { divisor: d })}
                            style={styles.itemSplitChip}
                          />
                        ))}
                        <Pressable
                          onPress={() => removeItem(it.key)}
                          hitSlop={8}
                          style={styles.deleteButton}
                          accessibilityLabel={`Remove ${it.name || "item"}`}
                        >
                          <Trash2 size={16} color={tokens.text3} />
                        </Pressable>
                      </View>
                    </>
                  )}
                </PopIn>
              );
            })}

            <Pressable
              onPress={addBlankItem}
              style={[styles.addItem, { paddingVertical: space.sm }]}
            >
              <Plus size={16} color={tokens.accent} />
              <Text
                style={{
                  color: tokens.accent,
                  fontFamily: fontFamily.bodySemiBold,
                  fontSize: type.body,
                }}
              >
                Add item
              </Text>
            </Pressable>

            {hasFee && (
              <PopIn play delay={MOUNT_START_DELAY_MS + 3 * BLOCK_STAGGER_MS}>
                <Card elevated={false} style={{ gap: space.sm }}>
                  <View style={styles.spaceBetween}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: tokens.text,
                          fontFamily: fontFamily.displaySemiBold,
                          fontSize: type.body,
                        }}
                      >
                        Fees &amp; discount
                      </Text>
                      <Text
                        style={{
                          color: tokens.text3,
                          fontFamily: fontFamily.bodySemiBold,
                          fontSize: type.caption,
                        }}
                      >
                        Split equally across everyone on the bill
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: tokens.text2,
                        fontFamily: fontFamily.bodySemiBold,
                        fontSize: type.body,
                      }}
                    >
                      {formatINR(feeAggregate)}
                    </Text>
                  </View>
                  {feeItems.length > 0 && (
                    <View style={{ gap: space.xs }}>
                      {feeItems.map((it) => (
                        <View key={it.key} style={styles.spaceBetween}>
                          <Text
                            style={{
                              color: tokens.text2,
                              fontFamily: fontFamily.bodyMedium,
                              fontSize: type.caption,
                            }}
                            numberOfLines={1}
                          >
                            {it.name || "Fee"}
                          </Text>
                          <Text
                            style={{
                              color: tokens.text2,
                              fontFamily: fontFamily.bodySemiBold,
                              fontSize: type.caption,
                            }}
                          >
                            {formatINR(it.price)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                  <View style={styles.spaceBetween}>
                    <Text
                      style={{
                        color: tokens.text2,
                        fontFamily: fontFamily.bodyBold,
                        fontSize: type.caption,
                      }}
                    >
                      People on this bill
                    </Text>
                    <View style={{ flexDirection: "row", gap: space.xs }}>
                      {PEOPLE_COUNTS.map((n) => (
                        <Chip
                          key={n}
                          label={String(n)}
                          selected={peopleCount === n}
                          onPress={() => setPeopleCount(n)}
                        />
                      ))}
                    </View>
                  </View>
                  <View style={styles.spaceBetween}>
                    <Text
                      style={{
                        color: tokens.text2,
                        fontFamily: fontFamily.bodyBold,
                        fontSize: type.caption,
                      }}
                    >
                      Your reconciled share
                    </Text>
                    <Text
                      style={{
                        color: tokens.accentInk,
                        fontFamily: fontFamily.bodyBold,
                        fontSize: type.caption,
                      }}
                    >
                      {formatINR(feeShare)}
                    </Text>
                  </View>
                </Card>
              </PopIn>
            )}

            <View
              style={[styles.divider, { backgroundColor: tokens.border }]}
            />

            <PopIn
              play
              delay={MOUNT_START_DELAY_MS + 4 * BLOCK_STAGGER_MS}
              style={[
                styles.row,
                { justifyContent: "space-between", gap: space.sm },
              ]}
            >
              <TextInput
                value={merchant}
                onChangeText={setMerchant}
                placeholder="Merchant"
                placeholderTextColor={tokens.text3}
                style={[
                  styles.nameInput,
                  {
                    backgroundColor: tokens.inputBg,
                    borderRadius: radius.md,
                    color: tokens.text,
                    fontFamily: fontFamily.bodyMedium,
                    fontSize: type.body,
                  },
                ]}
              />

              <Pressable
                onPress={() => setCategoryPickerOpen(true)}
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: tokens.cardSolid,
                    borderRadius: radius.full,
                    borderWidth: 1,
                    borderColor: tokens.border,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    color: tokens.text,
                    fontFamily: fontFamily.bodySemiBold,
                    fontSize: type.caption,
                  }}
                >
                  {selectedCategory
                    ? `${categoryEmoji(selectedCategory.name, selectedCategory.group)} ${splitEmoji(selectedCategory.name).text}`
                    : "Category"}
                </Text>
              </Pressable>
            </PopIn>
          </ScrollView>

          <View
            style={[
              styles.footer,
              {
                paddingHorizontal: space.lg,
                paddingBottom: insets.bottom + space.lg,
                gap: space.sm,
              },
            ]}
          >
            {selecting && (
              <View
                style={[
                  styles.bulkBar,
                  {
                    gap: space.sm,
                    backgroundColor: tokens.card,
                    borderRadius: radius.md,
                  },
                ]}
              >
                <View style={styles.spaceBetween}>
                  <Text
                    style={{
                      color: tokens.text,
                      fontFamily: fontFamily.bodyBold,
                      fontSize: type.caption,
                    }}
                  >
                    {selected.length === 0
                      ? "Tap rows to select"
                      : `${selected.length} selected · set split to`}
                  </Text>
                  <Pressable onPress={() => setSelected([])}>
                    <Text
                      style={{
                        color: tokens.text3,
                        fontFamily: fontFamily.bodyBold,
                        fontSize: type.caption,
                      }}
                    >
                      Clear
                    </Text>
                  </Pressable>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    gap: space.xs,
                    flexWrap: "wrap",
                  }}
                >
                  {DIVISORS.map((d) => (
                    <Chip
                      key={d}
                      label={splitLabel(d)}
                      onPress={() => applyBulkDivisor(d)}
                    />
                  ))}
                </View>
              </View>
            )}
            <Pressable
              onPress={() => canProceed && setPhase("confirm")}
              disabled={!canProceed}
              style={[
                styles.confirm,
                {
                  backgroundColor: tokens.accent,
                  borderRadius: radius.full,
                  paddingVertical: space.md + 2,
                  opacity: canProceed ? 1 : 0.5,
                },
              ]}
            >
              <Text
                style={{
                  color: tokens.onAccent,
                  fontFamily: fontFamily.bodyBold,
                  fontSize: type.bodyLg,
                }}
              >
                Review {formatINR(myShare)} →
              </Text>
            </Pressable>
          </View>

          <BottomSheet
            visible={categoryPickerOpen}
            onClose={() => setCategoryPickerOpen(false)}
          >
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
              Choose a category
            </Text>
            <View
              style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}
            >
              {categories.map((c) => (
                <Chip
                  key={c.name}
                  selected={category === c.name}
                  label={`${categoryEmoji(c.name, c.group)} ${splitEmoji(c.name).text}`}
                  onPress={() => {
                    setCategory(c.name);
                    setCategoryPickerOpen(false);
                  }}
                />
              ))}
            </View>
          </BottomSheet>
        </>
      )}

      {phase === "confirm" && (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.body,
              { paddingHorizontal: space.lg, gap: space.lg },
            ]}
          >
            <PopIn play delay={MOUNT_START_DELAY_MS}>
              <Card
                elevated={false}
                style={{ alignItems: "center", gap: space.xs }}
              >
                <Text style={[styles.microLabel, { color: tokens.text3 }]}>
                  LOGGING TO {categoryLabel.toUpperCase()}
                </Text>
                <RevealAmount
                  value={myShare}
                  size={type.hero}
                  color={tokens.accentInk}
                />
                <Text
                  style={{
                    color: tokens.text3,
                    fontFamily: fontFamily.bodySemiBold,
                    fontSize: type.caption,
                    textAlign: "center",
                  }}
                >
                  {formatDate(date)} · from a scanned bill of{" "}
                  {formatINR(billTotal)}
                </Text>
              </Card>
            </PopIn>

            <View style={{ gap: space.xs, marginBottom: space.lg }}>
              <Text
                style={[
                  styles.microLabel,
                  { color: tokens.text3, paddingHorizontal: 4 },
                ]}
              >
                WHERE IT CAME FROM
              </Text>
              <Card
                elevated={false}
                padded={false}
                style={{ overflow: "hidden" }}
              >
                {buckets.map((b, i) => (
                  <PopIn
                    key={b.divisor}
                    play
                    delay={
                      MOUNT_START_DELAY_MS +
                      BLOCK_STAGGER_MS +
                      Math.min(i, ITEM_STAGGER_CAP_INDEX) * ITEM_STAGGER_MS
                    }
                    style={[
                      styles.bucketRow,
                      {
                        gap: space.sm,
                        padding: space.md,
                        borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0,
                        borderTopColor: tokens.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.badge,
                        {
                          borderRadius: radius.sm,
                          backgroundColor:
                            b.divisor === 1 ? tokens.pillBg : tokens.accentSoft,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color:
                            b.divisor === 1 ? tokens.text2 : tokens.accentInk,
                          fontFamily: fontFamily.bodyBold,
                          fontSize: type.caption,
                        }}
                      >
                        {b.divisor === 1 ? "1" : `÷${b.divisor}`}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        style={{
                          color: tokens.text,
                          fontFamily: fontFamily.bodyBold,
                          fontSize: type.body,
                        }}
                      >
                        {b.divisor === 1
                          ? "Fully mine"
                          : `Split ${b.divisor} ways`}
                      </Text>
                      <Text
                        style={{
                          color: tokens.text3,
                          fontFamily: fontFamily.bodySemiBold,
                          fontSize: type.micro,
                        }}
                      >
                        {b.count} {b.count === 1 ? "item" : "items"} ·{" "}
                        {b.divisor === 1
                          ? "100% yours"
                          : `you pay 1/${b.divisor}`}
                      </Text>
                      <View style={{ marginTop: 2 }}>
                        <RevealBar
                          pct={Math.max(
                            3,
                            Math.round((b.share / Math.max(1, myShare)) * 100),
                          )}
                          color={b.divisor === 1 ? tokens.text3 : tokens.accent}
                          trackColor={tokens.borderStrong}
                          height={4}
                        />
                      </View>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text
                        style={{
                          color: tokens.text,
                          fontFamily: fontFamily.bodySemiBold,
                          fontSize: type.body,
                        }}
                      >
                        {formatINR(b.share)}
                      </Text>
                      <Text
                        style={{
                          color: tokens.text3,
                          fontFamily: fontFamily.bodySemiBold,
                          fontSize: type.micro,
                        }}
                      >
                        of {formatINR(b.gross)}
                      </Text>
                    </View>
                  </PopIn>
                ))}
                {hasFee && (
                  <PopIn
                    play
                    delay={
                      MOUNT_START_DELAY_MS +
                      BLOCK_STAGGER_MS +
                      Math.min(buckets.length, ITEM_STAGGER_CAP_INDEX) *
                        ITEM_STAGGER_MS
                    }
                    style={[
                      styles.bucketRow,
                      {
                        gap: space.sm,
                        padding: space.md,
                        borderTopWidth:
                          buckets.length > 0 ? StyleSheet.hairlineWidth : 0,
                        borderTopColor: tokens.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.badge,
                        {
                          borderRadius: radius.sm,
                          backgroundColor: tokens.accentSoft,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: tokens.accentInk,
                          fontFamily: fontFamily.bodyBold,
                          fontSize: type.body,
                        }}
                      >
                        ₹
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        style={{
                          color: tokens.text,
                          fontFamily: fontFamily.bodyBold,
                          fontSize: type.body,
                        }}
                      >
                        Fees &amp; discount, reconciled
                      </Text>
                      <Text
                        style={{
                          color: tokens.text3,
                          fontFamily: fontFamily.bodySemiBold,
                          fontSize: type.micro,
                        }}
                      >
                        {formatINR(feeAggregate)} split equally across{" "}
                        {peopleCount} people
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: tokens.text,
                        fontFamily: fontFamily.bodySemiBold,
                        fontSize: type.body,
                      }}
                    >
                      {formatINR(feeShare)}
                    </Text>
                  </PopIn>
                )}
              </Card>
            </View>

            <PopIn play delay={MOUNT_START_DELAY_MS + 2 * BLOCK_STAGGER_MS}>
              <Card elevated={false} style={{ gap: space.sm }}>
                <View style={styles.spaceBetween}>
                  <Text
                    style={{
                      color: tokens.text2,
                      fontFamily: fontFamily.bodyBold,
                      fontSize: type.caption,
                    }}
                  >
                    Total bill
                  </Text>
                  <Text
                    style={{
                      color: tokens.text,
                      fontFamily: fontFamily.bodySemiBold,
                      fontSize: type.body,
                    }}
                  >
                    {formatINR(billTotal)}
                  </Text>
                </View>
                <RevealBar
                  pct={sharePct}
                  color={tokens.accent}
                  trackColor={tokens.borderStrong}
                  height={8}
                />
                <View style={styles.spaceBetween}>
                  <Text
                    style={{
                      color: tokens.accentInk,
                      fontFamily: fontFamily.bodyBold,
                      fontSize: type.caption,
                    }}
                  >
                    You {formatINR(myShare)} · {sharePct}%
                  </Text>
                  <Text
                    style={{
                      color: tokens.text3,
                      fontFamily: fontFamily.bodyBold,
                      fontSize: type.caption,
                    }}
                  >
                    Others {formatINR(billTotal - myShare)}
                  </Text>
                </View>
              </Card>
            </PopIn>
          </ScrollView>

          <View
            style={[
              styles.footer,
              {
                paddingHorizontal: space.lg,
                paddingBottom: insets.bottom + space.lg,
                gap: space.sm,
              },
            ]}
          >
            <Pressable
              onPress={handleConfirm}
              disabled={addExpense.isPending}
              style={[
                styles.confirm,
                {
                  backgroundColor: tokens.accent,
                  borderRadius: radius.full,
                  paddingVertical: space.md + 2,
                },
              ]}
            >
              <Text
                style={{
                  color: tokens.onAccent,
                  fontFamily: fontFamily.bodyBold,
                  fontSize: type.bodyLg,
                }}
              >
                {addExpense.isPending
                  ? "Saving…"
                  : `Log ${formatINR(myShare)} to ${categoryLabel}`}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setPhase("review")}
              style={styles.backToItems}
            >
              <Text
                style={{
                  color: tokens.text3,
                  fontFamily: fontFamily.bodyBold,
                  fontSize: type.caption,
                }}
              >
                Back to items
              </Text>
            </Pressable>
          </View>
        </>
      )}

      <BottomSheet visible={phase === "picking"} onClose={() => router.back()}>
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
          Scan a bill
        </Text>
        <View style={{ gap: space.sm }}>
          <Pressable
            onPress={() => pickFrom("camera")}
            style={[
              styles.sourceRow,
              {
                gap: space.sm,
                backgroundColor: tokens.inputBg,
                borderRadius: radius.md,
                padding: space.md,
              },
            ]}
          >
            <Camera size={20} color={tokens.text} />
            <Text
              style={{
                color: tokens.text,
                fontFamily: fontFamily.bodySemiBold,
                fontSize: type.body,
              }}
            >
              Take a photo
            </Text>
          </Pressable>
          <Pressable
            onPress={() => pickFrom("library")}
            style={[
              styles.sourceRow,
              {
                gap: space.sm,
                backgroundColor: tokens.inputBg,
                borderRadius: radius.md,
                padding: space.md,
              },
            ]}
          >
            <Images size={20} color={tokens.text} />
            <Text
              style={{
                color: tokens.text,
                fontFamily: fontFamily.bodySemiBold,
                fontSize: type.body,
              }}
            >
              Choose a screenshot
            </Text>
          </Pressable>
        </View>
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

/** A share/progress bar that grows from 0 on mount (delayed, eased), matching
 * the envelope ProgressBar's fill feel — but with a caller-given fixed color
 * instead of ProgressBar's spend-risk thresholds, which don't apply to a bill
 * share. Live pct changes after the first reveal tween immediately, so it
 * stays responsive to split/people-count taps instead of lagging FILL_DELAY. */
function RevealBar({
  pct,
  color,
  trackColor,
  height,
}: {
  pct: number;
  color: string;
  trackColor: string;
  height: number;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const width = useRef(new Animated.Value(0)).current;
  const revealed = useRef(false);
  const clamped = Math.max(0, Math.min(100, pct));

  useEffect(() => {
    if (trackWidth === 0) return;
    const isFirst = !revealed.current;
    revealed.current = true;
    Animated.timing(width, {
      toValue: (clamped / 100) * trackWidth,
      duration: FILL_DURATION,
      delay: isFirst ? FILL_DELAY : 0,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [trackWidth, clamped, width]);

  return (
    <View
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      style={[styles.barTrack, { height, backgroundColor: trackColor }]}
    >
      <Animated.View
        style={[styles.barFill, { width, backgroundColor: color }]}
      />
    </View>
  );
}

/** A hero amount that rolls up from ₹0 on mount instead of just appearing —
 * for the confirm phase's total, which (unlike the review phase's live
 * "your share") never changes again once you're on this screen. */
function RevealAmount({
  value,
  size,
  color,
}: {
  value: number;
  size: number;
  color: string;
}) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDisplay(value), FILL_DELAY);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <AmountText
      value={display}
      size={size}
      color={color}
      weight="displaySemiBold"
      animate
      ignoreHide
    />
  );
}

function ScreenHeader({
  onLeft,
  leftIcon: LeftIcon,
  title,
  subtitle,
  right,
}: {
  onLeft?: () => void;
  leftIcon?: LucideIcon;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const { tokens, space, type } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + space.sm,
          paddingHorizontal: space.lg,
          gap: space.sm,
        },
      ]}
    >
      {onLeft && LeftIcon && (
        <Pressable onPress={onLeft} hitSlop={12} accessibilityLabel="Close">
          <LeftIcon size={22} color={tokens.text} />
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.headerTitle,
            {
              color: tokens.text,
              fontFamily: fontFamily.displaySemiBold,
              fontSize: type.bodyLg,
            },
          ]}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            style={{
              color: tokens.text3,
              fontFamily: fontFamily.bodySemiBold,
              fontSize: type.micro,
            }}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {right ?? <View style={{ width: 22 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingBottom: 8 },
  headerTitle: {},
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  body: { paddingTop: 8, paddingBottom: 40 },
  row: { flexDirection: "row", alignItems: "center" },
  spaceBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  microLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  barTrack: { height: 6, borderRadius: 999, overflow: "hidden", width: "100%" },
  barFill: { height: "100%", borderRadius: 999 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, padding: 0 },
  clearButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  allMineButton: {
    paddingHorizontal: 14,
    justifyContent: "center",
    height: 40,
  },
  itemCard: { padding: 12 },
  nameInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  itemNameInput: { padding: 0 },
  itemSplitChip: { paddingHorizontal: 10, paddingVertical: 6 },
  deleteButton: { marginLeft: "auto", padding: 4 },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  addItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  divider: { height: StyleSheet.hairlineWidth },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: "center",
  },
  footer: {},
  confirm: { alignItems: "center" },
  backToItems: { alignItems: "center", paddingVertical: 6 },
  bulkBar: { padding: 12 },
  sheetTitle: { marginBottom: 12 },
  sourceRow: { flexDirection: "row", alignItems: "center" },
  selectToggle: {
    height: 30,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  bucketRow: { flexDirection: "row", alignItems: "center" },
  badge: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
});
