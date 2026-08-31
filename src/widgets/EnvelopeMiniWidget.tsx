// The 2x2 "mini" widget — fixed size, no resize. Same snapshot as the others,
// stripped to just the number and one button.
import { FlexWidget, TextWidget, SvgWidget } from "react-native-android-widget";
import type { ThemeTokens } from "@/src/theme/tokens";
import { fontFamily } from "@/src/theme/fonts";
import { headerRightLabel, type WidgetData } from "./data";
import { WidgetSurface, color } from "./surface";
import { plusSvg, trendingSvg } from "./icons";

const LOG_URI = "mobile://modals/log-expense";

export function EnvelopeMiniWidget({
  tokens,
  scheme,
  ...data
}: WidgetData & { tokens: ThemeTokens; scheme: "light" | "dark" }) {
  const flat = !data.weeklyTrend || data.weeklyTrend.dir === "flat";
  const trendColor = flat
    ? null
    : data.weeklyTrend!.dir === "down"
      ? tokens.mint
      : tokens.coral;
  const trendDir =
    !data.weeklyTrend || data.weeklyTrend.dir === "flat"
      ? "up"
      : data.weeklyTrend!.dir;
  return (
    <WidgetSurface
      tokens={tokens}
      scheme={scheme}
      style={{ paddingHorizontal: 10, paddingVertical: 14 }}
    >
      <FlexWidget
        style={{
          width: "match_parent",
          flex: 1,
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <TextWidget
          text={data.totalLeft}
          truncate="END"
          maxLines={1}
          style={{
            width: "match_parent",
            fontSize: 22,
            fontFamily: fontFamily.displayBold,
            color: color(tokens.text),
          }}
        />
        <FlexWidget
          style={{
            width: "match_parent",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <TextWidget
            text={headerRightLabel(data.daysLeft, data.updatedAt)}
            style={{
              fontSize: 10,
              fontFamily: fontFamily.bodyMedium,
              color: color(tokens.text2),
            }}
          />
          {!flat && trendColor && (
            <FlexWidget
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginLeft: 8,
              }}
            >
              <SvgWidget
                svg={trendingSvg(trendDir, trendColor)}
                style={{ width: 10, height: 10, marginRight: 3 }}
              />
              <TextWidget
                text={`${data.weeklyTrend!.pct}%`}
                style={{
                  fontSize: 10,
                  fontFamily: fontFamily.bodySemiBold,
                  color: color(trendColor),
                }}
              />
            </FlexWidget>
          )}
        </FlexWidget>
      </FlexWidget>
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: LOG_URI }}
        accessibilityLabel="Log an expense"
        style={{
          width: "match_parent",
          height: 32,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 100,
          backgroundColor: color(tokens.accent),
        }}
      >
        <SvgWidget
          svg={plusSvg(tokens.onAccent)}
          style={{ width: 14, height: 14, marginRight: 6 }}
        />
        <TextWidget
          text="Log"
          style={{
            fontSize: 12,
            fontFamily: fontFamily.bodySemiBold,
            color: color(tokens.onAccent),
          }}
        />
      </FlexWidget>
    </WidgetSurface>
  );
}
