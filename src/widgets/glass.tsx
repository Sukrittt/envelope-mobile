// Shared "smoked glass" chrome for all three widget sizes. RemoteViews has no
// blur API — this is the closest honest approximation: a translucent fill so
// the wallpaper still reads through, a hairline border, and a faint top-down
// sheen gradient for a bit of glossiness.
//
// `backgroundGradient` replaces a view's whole background drawable (border
// included) natively — see BaseWidget.java's "This will overwrite border"
// comment — so the sheen can't live on the same node as the border. It's
// layered on top instead, via OverlapWidget, as its own borderless node.
import { FlexWidget, OverlapWidget } from 'react-native-android-widget'
import type { ColorProp, FlexWidgetStyle } from 'react-native-android-widget'
import type { ThemeTokens } from '@/src/theme/tokens'

export function color(c: string): ColorProp {
  return c as ColorProp
}

const SMOKE_DARK = color('rgba(0, 0, 0, 0.52)')
const SMOKE_LIGHT = color('rgba(255, 255, 255, 0.52)')
const SHEEN_FROM = color('rgba(255, 255, 255, 0.10)')
const SHEEN_TO = color('rgba(255, 255, 255, 0)')
// Matches Android 12+'s own widget-corner mask (system_app_widget_background_radius,
// ~28dp on AOSP/Pixel) — a different radius here double-corners against it.
const RADIUS = 28

export function GlassFrame({
  tokens,
  scheme,
  style,
  children,
}: {
  tokens: ThemeTokens
  scheme: 'light' | 'dark'
  style?: FlexWidgetStyle
  children?: React.ReactNode
}) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: scheme === 'dark' ? SMOKE_DARK : SMOKE_LIGHT,
        borderWidth: 1,
        borderColor: color(tokens.border),
        borderRadius: RADIUS,
        overflow: 'hidden',
      }}
    >
      <OverlapWidget style={{ width: 'match_parent', height: 'match_parent' }}>
        <FlexWidget
          style={{
            width: 'match_parent',
            height: 'match_parent',
            backgroundGradient: { from: SHEEN_FROM, to: SHEEN_TO, orientation: 'TOP_BOTTOM' },
          }}
        />
        <FlexWidget
          clickAction="OPEN_APP"
          style={{ width: 'match_parent', height: 'match_parent', padding: 12, flexDirection: 'column', ...style }}
        >
          {children}
        </FlexWidget>
      </OverlapWidget>
    </FlexWidget>
  )
}
