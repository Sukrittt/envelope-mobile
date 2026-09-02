import { useState } from "react";
import { View, Text, Pressable, ScrollView, Alert, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ArrowLeft, ArchiveRestore } from "lucide-react-native";
import { useTheme } from "@/src/theme/ThemeProvider";
import { fontFamily } from "@/src/theme/fonts";
import { Icon } from "@/src/components/shared/Icon";
import { LoadingPhrase } from "@/src/components/shared/LoadingPhrase";
import { daysUntil } from "@/src/lib/format";
import {
  getArchive,
  restoreArchivedItem,
  type ArchivedItem,
  type ArchivableCollection,
} from "@/src/api/account";

const SECTION_LABELS: Record<ArchivableCollection, string> = {
  expenses: "Transactions",
  budgets: "Budgets",
  categories: "Categories",
  groups: "Groups",
  subscriptions: "Subscriptions",
  holdings: "Holdings",
};

const SECTION_ORDER: ArchivableCollection[] = [
  "expenses",
  "budgets",
  "categories",
  "groups",
  "subscriptions",
  "holdings",
];

const archiveKey = ["archive"] as const;
const LOADING_PHRASES = ["Loading your archive…"];

function groupByCollection(items: ArchivedItem[]): [ArchivableCollection, ArchivedItem[]][] {
  const groups = new Map<ArchivableCollection, ArchivedItem[]>();
  for (const item of items) {
    const list = groups.get(item.collection) ?? [];
    list.push(item);
    groups.set(item.collection, list);
  }
  return SECTION_ORDER.filter((c) => groups.has(c)).map((c) => [c, groups.get(c)!]);
}

export default function ArchiveScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const archiveQuery = useQuery({ queryKey: archiveKey, queryFn: getArchive });
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const handleRestore = async (item: ArchivedItem) => {
    setRestoringId(item.id);
    try {
      await restoreArchivedItem(item.collection, item.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries();
    } catch (err) {
      Alert.alert(
        "Could not restore",
        err instanceof Error && err.message.includes("already exists")
          ? err.message
          : "Check your connection and try again.",
      );
    } finally {
      setRestoringId(null);
    }
  };

  const sections = groupByCollection(archiveQuery.data ?? []);

  return (
    <View style={[styles.container, { backgroundColor: tokens.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: tokens.border }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={[styles.backButton, { backgroundColor: tokens.card, borderColor: tokens.border }]}
        >
          <Icon icon={ArrowLeft} size={20} color={tokens.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: tokens.text, fontFamily: fontFamily.displaySemiBold }]}>
          Archive
        </Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={[styles.intro, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
          Deleted items stay here for 7 days before they&apos;re gone for good.
        </Text>

        {archiveQuery.isLoading ? (
          <View style={{ marginVertical: 20 }}>
            <LoadingPhrase
              phrases={LOADING_PHRASES}
              color={tokens.text2}
              style={[styles.intro, { fontFamily: fontFamily.bodyMedium }]}
            />
          </View>
        ) : null}

        {!archiveQuery.isLoading && sections.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
            <Text style={[styles.emptyText, { color: tokens.text2, fontFamily: fontFamily.bodyMedium }]}>
              Nothing archived right now.
            </Text>
          </View>
        ) : null}

        {sections.map(([collection, items]) => (
          <View key={collection} style={styles.section}>
            <Text style={[styles.sectionLabel, { color: tokens.text3, fontFamily: fontFamily.bodyBold }]}>
              {SECTION_LABELS[collection].toUpperCase()}
            </Text>
            <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
              {items.map((item, i) => {
                const days = daysUntil(item.purgesAt);
                return (
                  <View key={item.id}>
                    {i > 0 ? <View style={[styles.divider, { backgroundColor: tokens.border }]} /> : null}
                    <View style={styles.row}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={[styles.itemLabel, { color: tokens.text, fontFamily: fontFamily.bodyBold }]}
                          numberOfLines={1}
                        >
                          {item.label || "Untitled"}
                        </Text>
                        <Text style={[styles.itemHint, { color: tokens.text2 }]}>
                          Purges in {days} day{days === 1 ? "" : "s"}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleRestore(item)}
                        disabled={restoringId === item.id}
                        style={[
                          styles.restoreButton,
                          { backgroundColor: tokens.inputBg, borderColor: tokens.borderStrong, opacity: restoringId === item.id ? 0.6 : 1 },
                        ]}
                      >
                        <Icon icon={ArchiveRestore} size={14} color={tokens.text} />
                        <Text style={[styles.restoreButtonText, { color: tokens.text, fontFamily: fontFamily.bodyBold }]}>
                          {restoringId === item.id ? "Restoring…" : "Restore"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 19 },
  scrollContent: { padding: 16, gap: 16 },
  intro: { fontSize: 12, lineHeight: 17 },
  emptyCard: { padding: 20, borderWidth: 1, borderRadius: 20, alignItems: "center" },
  emptyText: { fontSize: 13 },
  section: { gap: 8 },
  sectionLabel: { fontSize: 11, letterSpacing: 0.5, paddingHorizontal: 4 },
  card: { borderWidth: 1, borderRadius: 20, overflow: "hidden" },
  divider: { height: StyleSheet.hairlineWidth },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  itemLabel: { fontSize: 14 },
  itemHint: { fontSize: 11, marginTop: 2 },
  restoreButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 100,
    borderWidth: 1,
  },
  restoreButtonText: { fontSize: 12 },
});
