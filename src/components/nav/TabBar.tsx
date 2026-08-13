import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import type { BottomTabBarProps } from 'expo-router/js-tabs'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'

const TAB_ICON: Record<string, string> = {
  index: '🏠',
  activity: '📄',
  envelopes: '🏷️',
  more: '⚙️',
}

const TAB_LABEL: Record<string, string> = {
  index: 'Home',
  activity: 'Activity',
  envelopes: 'Envelopes',
  more: 'More',
}

/**
 * Custom tab bar matching the dc.html prototype's mobile nav exactly:
 * Home / Activity / (+Add, not a route — opens the log-expense modal) / Envelopes / More.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const byName = (name: string) => state.routes.find((r) => r.name === name)

  const renderTab = (name: 'index' | 'activity' | 'envelopes' | 'more') => {
    const route = byName(name)
    if (!route) return null
    const focused = state.routes[state.index]?.key === route.key
    const color = focused ? tokens.gold : tokens.text2

    return (
      <Pressable
        key={route.key}
        onPress={() => navigation.navigate(route.name)}
        style={styles.tab}
      >
        <Text style={{ fontSize: 20 }}>{TAB_ICON[name]}</Text>
        <Text style={[styles.label, { color, fontFamily: fontFamily.displayMedium }]}>{TAB_LABEL[name]}</Text>
      </Pressable>
    )
  }

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: tokens.tabbarBg,
          borderTopColor: tokens.borderStrong,
          paddingBottom: 10 + insets.bottom,
        },
      ]}
    >
      {renderTab('index')}
      {renderTab('activity')}
      <Pressable onPress={() => router.push('/modals/log-expense')} style={styles.addTab}>
        <View style={[styles.addButton, { backgroundColor: tokens.gold }]}>
          <Text style={[styles.addIcon, { color: tokens.onAccent }]}>+</Text>
        </View>
      </Pressable>
      {renderTab('envelopes')}
      {renderTab('more')}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingTop: 10,
    paddingHorizontal: 8,
    borderTopWidth: 1,
  },
  tab: { alignItems: 'center', gap: 3, flex: 1 },
  label: { fontSize: 10 },
  addTab: { alignItems: 'center', flex: 1 },
  addButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  addIcon: { fontSize: 22, lineHeight: 24 },
})
