import type { LucideIcon } from 'lucide-react-native'
import { useTheme } from '@/src/theme/ThemeProvider'

interface IconProps {
  icon: LucideIcon
  size?: number
  color?: string
  strokeWidth?: number
}

export function Icon({ icon: IconComponent, size = 20, color, strokeWidth = 2 }: IconProps) {
  const { tokens } = useTheme()
  return <IconComponent size={size} color={color ?? tokens.text} strokeWidth={strokeWidth} />
}
