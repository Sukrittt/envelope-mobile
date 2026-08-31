import { Tabs } from 'expo-router/js-tabs'

import { useTheme } from '@/src/theme/ThemeProvider'

export default function TabsLayout() {
  const { tokens } = useTheme()

  return (
    <Tabs
      tabBar={() => null}
      screenOptions={{ headerShown: false, animation: 'fade', sceneStyle: { backgroundColor: tokens.bg } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="envelopes" />
      <Tabs.Screen name="more" />
    </Tabs>
  )
}
