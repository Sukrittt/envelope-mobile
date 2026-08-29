// The large (4x4, resizable) widget. Presentational only — RemoteViews via
// react-native-android-widget, not RN views. Rendered both by the app
// (WidgetSync, live data) and the headless widget-task-handler (last
// snapshot), so it must not touch hooks, storage, or navigation itself; only
// clickAction/clickActionData for taps.
import { FlexWidget, TextWidget } from 'react-native-android-widget'
import { fillColor } from '@/src/components/envelope/ProgressBar'
import type { ThemeTokens } from '@/src/theme/tokens'
import { fontFamily } from '@/src/theme/fonts'
import { headerRightLabel, layoutFor, type WidgetData } from './data'
import { GlassFrame, color } from './glass'

const LOG_URI = 'mobile://modals/log-expense'

export function EnvelopeWidget({
  tokens,
  scheme,
  width,
  height,
  ...data
}: WidgetData & { tokens: ThemeTokens; scheme: 'light' | 'dark'; width: number; height: number }) {
  const layout = layoutFor(width, height)
  const rows = data.rows.slice(0, layout.rows)
  const today = data.today.slice(0, layout.today)
  const chips = data.chips.slice(0, layout.buttons)
  const rupeeSign = data.totalLeft.slice(0, 1)
  const amount = data.totalLeft.slice(1)

  return (
    <GlassFrame tokens={tokens} scheme={scheme}>
      <TextWidget
        text={headerRightLabel(data.daysLeft, data.updatedAt)}
        style={{ fontSize: 11, fontFamily: fontFamily.bodyMedium, color: color(tokens.text2), letterSpacing: 0.5 }}
      />
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'flex-end', marginTop: 2 }}>
        <TextWidget text={rupeeSign} style={{ fontSize: 18, fontFamily: fontFamily.bodyMedium, color: color(tokens.accent), marginBottom: 3 }} />
        <TextWidget text={amount} style={{ fontSize: 32, fontFamily: fontFamily.displayBold, color: color(tokens.accent) }} />
      </FlexWidget>

      {rows.length > 0 && (
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', marginTop: 10 }}>
          {rows.map((row) => (
            <FlexWidget key={row.name} style={{ width: 'match_parent', flexDirection: 'column', marginTop: 7 }}>
              <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between' }}>
                <TextWidget
                  text={row.name}
                  truncate="END"
                  maxLines={1}
                  style={{ fontSize: 13, fontFamily: fontFamily.bodyMedium, color: color(tokens.text) }}
                />
                <TextWidget
                  text={`${row.available} · ${Math.round(row.pct)}%`}
                  style={{ fontSize: 13, fontFamily: fontFamily.bodyMedium, color: color(tokens.text2) }}
                />
              </FlexWidget>
              <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', height: 4, marginTop: 4, borderRadius: 2, overflow: 'hidden' }}>
                {(() => {
                  // Clamped so a fully-spent envelope still leaves a visible
                  // track remainder — a bar that reaches the full width reads
                  // as a section divider, not a progress bar.
                  const filled = Math.max(2, Math.min(92, Math.round(row.pct)))
                  return (
                    <>
                      <FlexWidget style={{ flex: filled, height: 4, backgroundColor: color(fillColor(row.pct, tokens)) }} />
                      <FlexWidget style={{ flex: 100 - filled, height: 4, backgroundColor: color(tokens.borderStrong) }} />
                    </>
                  )
                })()}
              </FlexWidget>
            </FlexWidget>
          ))}
        </FlexWidget>
      )}

      <FlexWidget style={{ width: 'match_parent', height: 1, marginTop: 12, backgroundColor: color(tokens.borderStrong) }} />

      {layout.today > 0 && (
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', marginTop: 10 }}>
          <TextWidget
            text="TODAY"
            style={{ fontSize: 10, fontFamily: fontFamily.bodySemiBold, color: color(tokens.text2), letterSpacing: 0.5 }}
          />
          {today.length === 0 ? (
            <TextWidget
              text="NOTHING YET"
              style={{ fontSize: 12, fontFamily: fontFamily.bodyMedium, color: color(tokens.text3), marginTop: 4 }}
            />
          ) : (
            today.map((t, i) => (
              <FlexWidget key={i} style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <TextWidget
                  text={t.item}
                  truncate="END"
                  maxLines={1}
                  style={{ fontSize: 12, fontFamily: fontFamily.bodyMedium, color: color(tokens.text2) }}
                />
                <TextWidget text={t.amount} style={{ fontSize: 12, fontFamily: fontFamily.bodyMedium, color: color(tokens.text2) }} />
              </FlexWidget>
            ))
          )}
        </FlexWidget>
      )}

      <FlexWidget style={{ flex: 1 }} />

      <FlexWidget style={{ width: 'match_parent', height: 1, marginBottom: 10, backgroundColor: color(tokens.border) }} />

      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row' }}>
        {chips.map((chip) => (
          <FlexWidget
            key={chip.category}
            clickAction="OPEN_URI"
            clickActionData={{ uri: chip.uri }}
            accessibilityLabel={`Log a ${chip.category} expense`}
            style={{
              flex: 1,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 6,
              borderRadius: 100,
              borderWidth: 1,
              borderColor: color(tokens.borderStrong),
            }}
          >
            <TextWidget
              text={chip.label}
              truncate="END"
              maxLines={1}
              style={{ fontSize: 11, fontFamily: fontFamily.bodySemiBold, color: color(tokens.text2) }}
            />
          </FlexWidget>
        ))}
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: LOG_URI }}
          accessibilityLabel="Log an expense"
          style={{ flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 100, backgroundColor: color(tokens.accent) }}
        >
          <TextWidget text="+" style={{ fontSize: 13, fontFamily: fontFamily.bodySemiBold, color: color(tokens.onAccent) }} />
        </FlexWidget>
      </FlexWidget>
    </GlassFrame>
  )
}
