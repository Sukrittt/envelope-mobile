// Each widget has to survive buildWidgetTree — the library walks the JSX
// itself rather than rendering it through React, so anything React tolerates
// but the walker does not (a Fragment, most of all) throws here and the
// launcher is left showing an empty frame with no error anywhere on screen.
import { buildWidgetTree } from "react-native-android-widget/src/api/build-widget-tree";
import { darkTokens } from "@/src/theme/tokens";
import type { WidgetData } from "./data";
import { EnvelopeWidget } from "./EnvelopeWidget";
import { EnvelopeBarWidget } from "./EnvelopeBarWidget";
import { EnvelopeMiniWidget } from "./EnvelopeMiniWidget";

const data: WidgetData = {
  totalLeft: "₹85,287",
  daysLeft: 26,
  updatedAt: Date.now(),
  rows: [
    {
      icon: "🍔",
      name: "Food",
      pct: 82,
      available: "₹2,100",
      overspent: false,
    },
    { icon: "", name: "Rent", pct: 100, available: "-₹500", overspent: true },
  ],
  chips: [
    {
      category: "🍔 Food",
      label: "Food",
      uri: "mobile://modals/log-expense?category=Food",
    },
    {
      category: "🚕 Travel",
      label: "Travel",
      uri: "mobile://modals/log-expense?category=Travel",
    },
  ],
  today: [{ item: "Coffee", amount: "₹180" }],
  weeklyTrend: { pct: 20, dir: "down" },
};

describe("widget trees build", () => {
  // 4x4 through the tallest resize the provider allows.
  it.each([
    [250, 250],
    [250, 400],
    [320, 340],
  ])("EnvelopeWidget at %ix%i", (width, height) => {
    expect(() =>
      buildWidgetTree(
        <EnvelopeWidget
          {...data}
          tokens={darkTokens}
          scheme="dark"
          width={width}
          height={height}
        />,
      ),
    ).not.toThrow();
  });

  it("EnvelopeBarWidget", () => {
    expect(() =>
      buildWidgetTree(
        <EnvelopeBarWidget {...data} tokens={darkTokens} scheme="dark" />,
      ),
    ).not.toThrow();
  });

  it("EnvelopeMiniWidget", () => {
    expect(() =>
      buildWidgetTree(
        <EnvelopeMiniWidget
          {...data}
          tokens={darkTokens}
          scheme="dark"
          width={131}
        />,
      ),
    ).not.toThrow();
  });
});

// A 2x2 cell is taller than it is wide (~131x184dp on a Pixel-class grid), so
// a match_parent card comes out stretched next to a square one. The card takes
// its height from the cell width instead.
describe("EnvelopeMiniWidget draws a square card", () => {
  it.each([131, 110, 160])("at %idp wide", (width) => {
    const tree = buildWidgetTree(
      <EnvelopeMiniWidget
        {...data}
        tokens={darkTokens}
        scheme="dark"
        width={width}
      />,
    );
    // buildWidgetTree flattens style onto props. The root fills the cell and
    // centres the card; the card itself is the square one.
    const root = tree.props as { height: unknown; gravity: unknown };
    expect(root.height).toBe("match_parent");

    const card = tree.children![0].props as {
      width: unknown;
      height: unknown;
    };
    expect(card.height).toBe(width);
    expect(card.width).toBe("match_parent");
  });
});
