import Svg, { Path } from 'react-native-svg'
import { Plus } from 'lucide-react-native'

/**
 * The nav's own icon set. Home/Activity/Envelope/Profile/Plus are Phosphor
 * "regular"-weight glyphs (assets/nav/*.svg) recolored dynamically instead of
 * their baked-in black. Each path carves its own outline via winding rule
 * rather than a stroke — stroking it instead of filling it breaks the shape —
 * so every glyph always renders as a plain fill; selection is color only
 * (idle -> accent), never a change of rendering mode.
 *
 * All paths are drawn in a 256x256 box; `size` scales to the same rendered
 * footprint.
 */
export type NavGlyphProps = { size: number; color: string }
export type NavIconComponent = (props: NavGlyphProps) => React.ReactElement

const PHOSPHOR_BOX = 256

function Frame({ size, box, children }: { size: number; box: number; children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${box} ${box}`}>
      {children}
    </Svg>
  )
}

export const HomeGlyph: NavIconComponent = ({ size, color }) => (
  <Frame size={size} box={PHOSPHOR_BOX}>
    <Path
      d="M219.31,108.68l-80-80a16,16,0,0,0-22.62,0l-80,80A15.87,15.87,0,0,0,32,120v96a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8V160h32v56a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8V120A15.87,15.87,0,0,0,219.31,108.68ZM208,208H160V152a8,8,0,0,0-8-8H104a8,8,0,0,0-8,8v56H48V120l80-80,80,80Z"
      fill={color}
    />
  </Frame>
)

export const ActivityGlyph: NavIconComponent = ({ size, color }) => (
  <Frame size={size} box={PHOSPHOR_BOX}>
    <Path
      d="M72,104a8,8,0,0,1,8-8h96a8,8,0,0,1,0,16H80A8,8,0,0,1,72,104Zm8,40h96a8,8,0,0,0,0-16H80a8,8,0,0,0,0,16ZM232,56V208a8,8,0,0,1-11.58,7.15L192,200.94l-28.42,14.21a8,8,0,0,1-7.16,0L128,200.94,99.58,215.15a8,8,0,0,1-7.16,0L64,200.94,35.58,215.15A8,8,0,0,1,24,208V56A16,16,0,0,1,40,40H216A16,16,0,0,1,232,56Zm-16,0H40V195.06l20.42-10.22a8,8,0,0,1,7.16,0L96,199.06l28.42-14.22a8,8,0,0,1,7.16,0L160,199.06l28.42-14.22a8,8,0,0,1,7.16,0L216,195.06Z"
      fill={color}
    />
  </Frame>
)

export const EnvelopeGlyph: NavIconComponent = ({ size, color }) => (
  <Frame size={size} box={PHOSPHOR_BOX}>
    <Path
      d="M245,110.64A16,16,0,0,0,232,104H216V88a16,16,0,0,0-16-16H130.67L102.94,51.2a16.14,16.14,0,0,0-9.6-3.2H40A16,16,0,0,0,24,64V208h0a8,8,0,0,0,8,8H211.1a8,8,0,0,0,7.59-5.47l28.49-85.47A16.05,16.05,0,0,0,245,110.64ZM93.34,64,123.2,86.4A8,8,0,0,0,128,88h72v16H69.77a16,16,0,0,0-15.18,10.94L40,158.7V64Zm112,136H43.1l26.67-80H232Z"
      fill={color}
    />
  </Frame>
)

export const ProfileGlyph: NavIconComponent = ({ size, color }) => (
  <Frame size={size} box={PHOSPHOR_BOX}>
    <Path
      d="M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z"
      fill={color}
    />
  </Frame>
)

export const PlusGlyph: NavIconComponent = ({ size, color }) => (
  <Plus size={size} color={color} strokeWidth={2.5} />
)

