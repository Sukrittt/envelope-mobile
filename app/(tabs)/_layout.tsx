import { View, StyleSheet } from 'react-native'
import { Tabs } from 'expo-router/js-tabs'
import { TabBar } from '@/src/components/nav/TabBar'

/**
 * The nav is a sibling overlay rather than the navigator's tabBar slot: it
 * floats over the screens with no bar of its own, and an absolutely-positioned
 * child of the tabBar slot (which has no height) is untouchable on Android.
 */
export default function TabsLayout() {
  return (
    <View style={styles.root}>
      <Tabs tabBar={() => null} screenOptions={{ headerShown: false, animation: 'none' }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="activity" />
        <Tabs.Screen name="envelopes" />
        <Tabs.Screen name="more" />
      </Tabs>
      <TabBar />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
