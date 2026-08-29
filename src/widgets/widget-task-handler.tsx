// Runs headless — no app mounted, no React context, no QueryClient. Handles
// only what WidgetSync (app-side, src/widgets/WidgetSync.tsx) can't: a widget
// being added/resized, or the OS's 30-minute update timer while the app
// isn't open. Reads the last snapshot the app wrote; never fetches, never
// touches auth — see the plan's note on why (WorkOS refresh-token rotation
// races between this JS realm and the app's).
import type { WidgetTaskHandlerProps } from 'react-native-android-widget'
import { lightTokens, darkTokens } from '@/src/theme/tokens'
import { readSnapshot } from './snapshot'
import { EnvelopeWidget } from './EnvelopeWidget'
import { EnvelopeBarWidget } from './EnvelopeBarWidget'
import { EnvelopeMiniWidget } from './EnvelopeMiniWidget'
import { SignInWidget } from './SignInWidget'

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const data = await readSnapshot()
      const { widgetName, width, height } = props.widgetInfo
      const compact = widgetName !== 'Envelope'

      if (!data) {
        props.renderWidget({
          light: <SignInWidget tokens={lightTokens} scheme="light" compact={compact} />,
          dark: <SignInWidget tokens={darkTokens} scheme="dark" compact={compact} />,
        })
        break
      }

      switch (widgetName) {
        case 'EnvelopeBar':
          props.renderWidget({
            light: <EnvelopeBarWidget {...data} tokens={lightTokens} scheme="light" />,
            dark: <EnvelopeBarWidget {...data} tokens={darkTokens} scheme="dark" />,
          })
          break
        case 'EnvelopeMini':
          props.renderWidget({
            light: <EnvelopeMiniWidget {...data} tokens={lightTokens} scheme="light" />,
            dark: <EnvelopeMiniWidget {...data} tokens={darkTokens} scheme="dark" />,
          })
          break
        default:
          props.renderWidget({
            light: <EnvelopeWidget {...data} tokens={lightTokens} scheme="light" width={width} height={height} />,
            dark: <EnvelopeWidget {...data} tokens={darkTokens} scheme="dark" width={width} height={height} />,
          })
          break
      }
      break
    }
    default:
      break
  }
}
