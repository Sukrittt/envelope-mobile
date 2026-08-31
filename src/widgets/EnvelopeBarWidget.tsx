// The 4x1 "bar" widget — one line, no resize. Same snapshot as the large
// widget, just the hero number and a single LOG button.
import { FlexWidget, TextWidget } from 'react-native-android-widget'
import type { ThemeTokens } from '@/src/theme/tokens'
import { fontFamily } from '@/src/theme/fonts'
import { headerRightLabel, type WidgetData } from './data'
import { WidgetSurface, color } from './surface'

const LOG_URI = 'mobile://modals/log-expense'

export function EnvelopeBarWidget({ tokens, scheme, ...data }: WidgetData & { tokens: ThemeTokens; scheme: 'light' | 'dark' }) {
  return (
    <WidgetSurface
      tokens={tokens}
      scheme={scheme}
      style={{ paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
    >
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 8 }}>
        <TextWidget text={data.totalLeft} style={{ fontSize: 19, fontFamily: fontFamily.displayBold, color: color(tokens.text) }} />
        <TextWidget
          text={headerRightLabel(data.daysLeft, data.updatedAt)}
          style={{ fontSize: 11, fontFamily: fontFamily.bodyMedium, color: color(tokens.text2) }}
        />
      </FlexWidget>
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: LOG_URI }}
        accessibilityLabel="Log an expense"
        style={{ paddingHorizontal: 22, paddingVertical: 10, borderRadius: 100, backgroundColor: color(tokens.accent) }}
      >
        <TextWidget text="Log" style={{ fontSize: 13, fontFamily: fontFamily.bodySemiBold, color: color(tokens.onAccent) }} />
      </FlexWidget>
    </WidgetSurface>
  )
}
