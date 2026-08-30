// The 2x2 "mini" widget — fixed size, no resize. Same snapshot as the others,
// stripped to just the number and one button.
import { FlexWidget, TextWidget, SvgWidget } from 'react-native-android-widget'
import type { ThemeTokens } from '@/src/theme/tokens'
import { fontFamily } from '@/src/theme/fonts'
import { headerRightLabel, type WidgetData } from './data'
import { WidgetSurface, color } from './surface'
import { plusSvg } from './icons'

const LOG_URI = 'mobile://modals/log-expense'

export function EnvelopeMiniWidget({ tokens, scheme, ...data }: WidgetData & { tokens: ThemeTokens; scheme: 'light' | 'dark' }) {
  return (
    <WidgetSurface tokens={tokens} scheme={scheme} style={{ padding: 14 }}>
      <FlexWidget style={{ width: 'match_parent', flex: 1, flexDirection: 'column', justifyContent: 'center' }}>
        <TextWidget
          text={data.totalLeft}
          truncate="END"
          maxLines={1}
          style={{ width: 'match_parent', fontSize: 26, fontFamily: fontFamily.displayBold, color: color(tokens.text) }}
        />
        <TextWidget
          text={headerRightLabel(data.daysLeft, data.updatedAt)}
          style={{ width: 'match_parent', fontSize: 10, fontFamily: fontFamily.bodyMedium, color: color(tokens.text2), marginTop: 2 }}
        />
      </FlexWidget>
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: LOG_URI }}
        accessibilityLabel="Log an expense"
        style={{
          width: 'match_parent',
          height: 40,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 100,
          backgroundColor: color(tokens.accent),
        }}
      >
        <SvgWidget svg={plusSvg(tokens.onAccent)} style={{ width: 14, height: 14, marginRight: 6 }} />
        <TextWidget text="Log" style={{ fontSize: 12, fontFamily: fontFamily.bodySemiBold, color: color(tokens.onAccent) }} />
      </FlexWidget>
    </WidgetSurface>
  )
}
