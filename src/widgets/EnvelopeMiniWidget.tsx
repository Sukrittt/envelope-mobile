// The 2x2 "mini" widget — fixed size, no resize. Same snapshot as the others,
// stripped to just the number and one button.
import { FlexWidget, TextWidget } from 'react-native-android-widget'
import type { ThemeTokens } from '@/src/theme/tokens'
import { fontFamily } from '@/src/theme/fonts'
import { headerRightLabel, type WidgetData } from './data'
import { GlassFrame, color } from './glass'

const LOG_URI = 'mobile://modals/log-expense'

export function EnvelopeMiniWidget({ tokens, scheme, ...data }: WidgetData & { tokens: ThemeTokens; scheme: 'light' | 'dark' }) {
  return (
    <GlassFrame tokens={tokens} scheme={scheme}>
      <TextWidget
        text={headerRightLabel(data.daysLeft, data.updatedAt)}
        style={{ width: 'match_parent', fontSize: 11, fontFamily: fontFamily.bodyMedium, color: color(tokens.text2), letterSpacing: 0.5 }}
      />
      <FlexWidget style={{ width: 'match_parent', flex: 1, justifyContent: 'center' }}>
        <TextWidget
          text={data.totalLeft}
          truncate="END"
          maxLines={1}
          style={{ width: 'match_parent', fontSize: 30, fontFamily: fontFamily.displayBold, color: color(tokens.accent) }}
        />
      </FlexWidget>
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: LOG_URI }}
        accessibilityLabel="Log an expense"
        style={{
          width: 'match_parent',
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 100,
          backgroundColor: color(tokens.accentInk),
        }}
      >
        <TextWidget text="+ LOG" style={{ fontSize: 12, fontFamily: fontFamily.bodySemiBold, color: color(tokens.onAccent) }} />
      </FlexWidget>
    </GlassFrame>
  )
}
