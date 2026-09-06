import { PopIn } from "@/src/components/shared/PopIn";
import { Card } from "@/src/components/ui/Card";
import { formatDate, formatINR } from "@/src/lib/format";
import { fontFamily } from "@/src/theme/fonts";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";


import { RevealAmount, RevealBar } from "./ScanAnimations";
import { BLOCK_STAGGER_MS, ITEM_STAGGER_CAP_INDEX, ITEM_STAGGER_MS, MOUNT_START_DELAY_MS } from "./presentation";
import { styles } from "./styles";
import type { useScanBillController } from "./useScanBillController";
type Props = Pick<ReturnType<typeof useScanBillController>, "tokens" | "space" | "radius" | "type" | "insets" | "setPhase" | "date" | "items" | "peopleCount" | "feeAggregate" | "hasFee" | "feeShare" | "billTotal" | "myShare" | "sharePct" | "buckets" | "handleConfirm" | "categoryLabel" | "addExpense">;
export function ScanConfirm({ tokens, space, radius, type, insets, setPhase, date, items, peopleCount, feeAggregate, hasFee, feeShare, billTotal, myShare, sharePct, buckets, handleConfirm, categoryLabel, addExpense }: Props) {
  return (<>
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
  </>);
}
