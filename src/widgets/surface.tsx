// Shared card chrome for all three widget sizes. Near-opaque app surface
// (not glass) so text contrast never depends on the wallpaper behind it, plus
// a faint hero-tinted top-down wash echoing Home's hero section.
//
// `backgroundGradient` replaces a view's whole background drawable (border
// included) natively — see BaseWidget.java's "This will overwrite border"
// comment — so the wash can't live on the same node as the border. It's
// layered on top instead, via OverlapWidget, as its own borderless node.
import { FlexWidget, OverlapWidget } from "react-native-android-widget";
import type { ColorProp, FlexWidgetStyle } from "react-native-android-widget";
import type { ThemeTokens } from "@/src/theme/tokens";

export function color(c: string): ColorProp {
  return c as ColorProp;
}

const SURFACE_DARK = color("rgba(10, 10, 10, 0.94)");
const SURFACE_LIGHT = color("rgba(252, 252, 252, 0.94)");
// Matches Android 12+'s own widget-corner mask (system_app_widget_background_radius,
// ~28dp on AOSP/Pixel) — a different radius here double-corners against it.
const RADIUS = 28;

export function WidgetSurface({
  tokens,
  scheme,
  height,
  style,
  children,
}: {
  tokens: ThemeTokens;
  scheme: "light" | "dark";
  /** Fixed card height in dp. Without it the card fills whatever cell the
   *  launcher hands out, and a "2x2" cell is not square — on a Pixel-class
   *  grid it is ~131dp wide by ~184dp tall, which is what made the mini
   *  widget look stretched next to a square one. */
  height?: number;
  style?: FlexWidgetStyle;
  children?: React.ReactNode;
}) {
  const heroFrom = color(tokens.heroA);
  const heroTo = color(
    scheme === "dark" ? "rgba(0, 0, 0, 0)" : "rgba(255, 255, 255, 0)",
  );

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: height ?? "match_parent",
        width: "match_parent",
        backgroundColor: scheme === "dark" ? SURFACE_DARK : SURFACE_LIGHT,
        borderWidth: 1,
        borderColor: color(tokens.border),
        borderRadius: RADIUS,
        overflow: "hidden",
      }}
    >
      <OverlapWidget style={{ width: "match_parent", height: "match_parent" }}>
        <FlexWidget
          style={{
            width: "match_parent",
            height: "match_parent",
            backgroundGradient: {
              from: heroFrom,
              to: heroTo,
              orientation: "TOP_BOTTOM",
            },
          }}
        />
        <FlexWidget
          clickAction="OPEN_APP"
          style={{
            width: "match_parent",
            height: "match_parent",
            flexDirection: "column",
            ...style,
          }}
        >
          {children}
        </FlexWidget>
      </OverlapWidget>
    </FlexWidget>
  );
}
