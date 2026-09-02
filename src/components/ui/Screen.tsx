import type { ReactNode } from 'react'
import { View, Text, ScrollView, StyleSheet, type ViewStyle, type StyleProp } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'
import { NAV_HEIGHT } from '@/src/theme/scale'

/**
 * The app shell. One header implementation instead of the per-screen
 * `insets.top + N` blocks each screen used to carry: a large left-aligned
 * title with circular actions on the right.
 *
 * It also owns the bottom padding the detached floating nav needs. The nav has
 * no bar behind it and content scrolls underneath, so every scrolling screen
 * must reserve room or its last row sits under the circles — centralising it
 * here is what keeps that from being re-derived (and forgotten) per screen.
 */
export function Screen({
  title,
  actions,
  subheader,
  children,
  scroll = true,
  refreshControl,
  floatingNav = true,
  contentContainerStyle,
  style,
}: {
  title?: string
  actions?: ReactNode
  /** Rendered between the header and the scrolling content, outside the
   *  ScrollView — so it stays pinned while the rest of the screen scrolls,
   *  with no scroll listener or animation needed. */
  subheader?: ReactNode
  children: ReactNode
  scroll?: boolean
  refreshControl?: React.ComponentProps<typeof ScrollView>['refreshControl']
  /** Set false on screens rendered outside the tabs, which have no nav to clear. */
  floatingNav?: boolean
  contentContainerStyle?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle>
}) {
  const { tokens, space, type } = useTheme()
  const insets = useSafeAreaInsets()
  const bottomPad = (floatingNav ? NAV_HEIGHT : 0) + insets.bottom + space.lg

  const header = title ? (
    <View style={[styles.header, { paddingTop: insets.top + space.md, paddingHorizontal: space.lg, paddingBottom: space.md }]}>
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        style={[styles.title, { color: tokens.text, fontFamily: fontFamily.displayBold, fontSize: type.heading }]}
      >
        {title}
      </Text>
      {actions ? <View style={[styles.actions, { gap: space.sm }]}>{actions}</View> : null}
    </View>
  ) : null

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }, style]}>
      {header}
      {subheader ? (
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>{subheader}</View>
      ) : null}
      {scroll ? (
        <ScrollView
          style={styles.flex}
          refreshControl={refreshControl}
          contentContainerStyle={[{ paddingHorizontal: space.lg, paddingBottom: bottomPad }, contentContainerStyle]}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, { paddingHorizontal: space.lg }]}>{children}</View>
      )}
    </View>
  )
}

/** Bottom padding for screens that manage their own list (FlatList, SectionList). */
export function useNavPadding(floatingNav = true) {
  const { space } = useTheme()
  const insets = useSafeAreaInsets()
  return (floatingNav ? NAV_HEIGHT : 0) + insets.bottom + space.lg
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flexShrink: 1, letterSpacing: -0.5 },
  actions: { flexDirection: 'row', alignItems: 'center' },
})
