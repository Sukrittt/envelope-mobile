import { Tabs } from 'expo-router/js-tabs'

export default function TabsLayout() {
  return (
    <Tabs tabBar={() => null} screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="envelopes" />
      <Tabs.Screen name="more" />
    </Tabs>
  )
}
