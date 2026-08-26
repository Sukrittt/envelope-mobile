import { View, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { House, ReceiptText, Tags, CircleUser, Plus, X, type LucideIcon } from 'lucide-react-native'
import { useTheme } from '@/src/theme/ThemeProvider'

const AnimatedPressable = Reanimated.createAnimatedComponent(Pressable)

export type NavRoute = 'index' | 'activity' | 'envelopes' | 'more'

/** Rendered left-to-right, with the add button occupying the centre slot. */
export const NAV_ROUTES: { name: NavRoute; icon: LucideIcon; label: string }[] = [
  { name: 'index', icon: House, label: 'Home' },
  { name: 'activity', icon: ReceiptText, label: 'Activity' },
  { name: 'envelopes', icon: Tags, label: 'Envelopes' },
  { name: 'more', icon: CircleUser, label: 'More' },
]

export const NAV_HREF: Record<NavRoute, '/' | '/activity' | '/envelopes' | '/more'> = {
  index: '/',
  activity: '/activity',
  envelopes: '/envelopes',
  more: '/more',
}

/** Which circle to light up for a pathname. Null on any screen outside the tabs. */
export function activeRouteFor(pathname: string): NavRoute | null {
  if (pathname === '/' || pathname === '/index') return 'index'
  const match = NAV_ROUTES.find((r) => pathname === `/${r.name}`)
  return match?.name ?? null
}

const CIRCLE = 46
const ADD_CIRCLE = 62

/**
 * Detached navigation: free-floating circles laid over the page, with no bar,
 * border or scrim behind them. Content scrolls underneath, so every screen
 * reserves NAV_HEIGHT of bottom padding (see Screen / useNavPadding).
 *
 * The centre slot is an action, not a destination, and is permanently large —
 * logging an expense is the app's primary verb. The active route is therefore
 * marked by an accent fill rather than by size, which would compete with it.
 *
 * All five circles share one press motion. Per-icon signature animations were
 * tried and removed: five different flourishes read as busy rather than crafted.
 */
export function FloatingNav({
  active,
  onSelect,
  onAdd,
  addActive = false,
  variant = 'default',
  children,
}: {
  active: NavRoute | null
  onSelect: (name: NavRoute) => void
  onAdd: () => void
  /** True on the log-expense screen: the add slot becomes "you are here". */
  addActive?: boolean
  /** `onAccent` restyles the nav for the flood screen's accent ground. */
  variant?: 'default' | 'onAccent'
  children?: React.ReactNode
}) {
  const { tokens, space, elevation } = useTheme()
  const insets = useSafeAreaInsets()
  const onAccent = variant === 'onAccent'

  const idle = onAccent ? 'rgba(255, 255, 255, 0.22)' : tokens.cardSolid
  const idleIcon = onAccent ? tokens.onAccent : tokens.text2
  const activeFill = onAccent ? tokens.onAccent : tokens.accent
  const activeIcon = onAccent ? tokens.accent : tokens.onAccent

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: insets.bottom + space.sm, gap: space.md }]}
    >
      {children}
      {NAV_ROUTES.slice(0, 2).map((r) => (
        <NavCircle
          key={r.name}
          icon={r.icon}
          label={r.label}
          size={CIRCLE}
          selected={active === r.name}
          background={active === r.name ? activeFill : idle}
          color={active === r.name ? activeIcon : idleIcon}
          onPress={() => onSelect(r.name)}
        />
      ))}
      <NavCircle
        icon={addActive ? X : Plus}
        label={addActive ? 'Close' : 'Log expense'}
        size={ADD_CIRCLE}
        selected={addActive}
        background={addActive ? activeFill : onAccent ? tokens.onAccent : tokens.accent}
        color={addActive ? activeIcon : onAccent ? tokens.accent : tokens.onAccent}
        onPress={onAdd}
        style={elevation.floating}
      />
      {NAV_ROUTES.slice(2).map((r) => (
        <NavCircle
          key={r.name}
          icon={r.icon}
          label={r.label}
          size={CIRCLE}
          selected={active === r.name}
          background={active === r.name ? activeFill : idle}
          color={active === r.name ? activeIcon : idleIcon}
          onPress={() => onSelect(r.name)}
        />
      ))}
    </View>
  )
}

function NavCircle({
  icon: IconComponent,
  label,
  size,
  selected,
  background,
  color,
  onPress,
  style,
}: {
  icon: LucideIcon
  label: string
  size: number
  selected: boolean
  background: string
  color: string
  onPress: () => void
  style?: object
}) {
  const { motion, elevation } = useTheme()
  const scale = useSharedValue(1)
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <AnimatedPressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPressIn={() => {
        scale.value = withSpring(0.88, motion.springTight)
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.spring)
      }}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
        onPress()
      }}
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background },
        elevation.card,
        style,
        animated,
      ]}
    >
      <IconComponent size={Math.round(size * 0.45)} color={color} strokeWidth={2.2} />
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  // Absolute so the circles overlay content rather than reserving a strip of it.
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: { alignItems: 'center', justifyContent: 'center' },
})
