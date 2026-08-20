import { useRef } from 'react'
import { Animated, View, Text, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import type { BottomTabBarProps } from 'expo-router/js-tabs'
import { House, ReceiptText, Tags, CircleUser, Plus, type LucideIcon } from 'lucide-react-native'
import { useTheme } from '@/src/theme/ThemeProvider'
import { fontFamily } from '@/src/theme/fonts'

const TAB_ICON: Record<string, LucideIcon> = {
  index: House,
  activity: ReceiptText,
  envelopes: Tags,
  more: CircleUser,
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

  const scales = useRef({
    index: new Animated.Value(1),
    activity: new Animated.Value(1),
    envelopes: new Animated.Value(1),
    more: new Animated.Value(1),
  }).current

  const bounce = (name: keyof typeof scales) => {
    const scale = scales[name]
    scale.setValue(0.85)
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 8, stiffness: 220 }).start()
  }

  const renderTab = (name: 'index' | 'activity' | 'envelopes' | 'more') => {
    const route = byName(name)
    if (!route) return null
    const focused = state.routes[state.index]?.key === route.key
    const color = focused ? tokens.gold : tokens.text2
    const TabIcon = TAB_ICON[name]

    return (
      <Pressable
        key={route.key}
        onPress={() => {
          bounce(name)
          navigation.navigate(route.name)
        }}
        style={styles.tab}
      >
        <Animated.View style={{ alignItems: 'center', gap: 3, transform: [{ scale: scales[name] }] }}>
          <TabIcon size={24} color={color} strokeWidth={2} />
          <Text style={[styles.label, { color, fontFamily: fontFamily.displayMedium }]}>{TAB_LABEL[name]}</Text>
        </Animated.View>
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
          <Plus size={24} color={tokens.onAccent} strokeWidth={2} />
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
})
