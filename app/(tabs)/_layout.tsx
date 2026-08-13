import { Tabs } from 'expo-router/js-tabs'
import { TabBar } from '@/src/components/nav/TabBar'

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="envelopes" />
      <Tabs.Screen name="more" />
    </Tabs>
  )
}
