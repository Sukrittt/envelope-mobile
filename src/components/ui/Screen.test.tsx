import { ScrollView, StyleSheet, Text } from 'react-native'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import { Screen } from './Screen'

it('leaves breathing room below scroll content above the floating navigation', () => {
  const screen = renderWithProviders(
    <Screen title="Activity">
      <Text>Last transaction</Text>
    </Screen>,
  )

  const scrollView = screen.UNSAFE_getByType(ScrollView)
  const contentStyle = StyleSheet.flatten(scrollView.props.contentContainerStyle)

  // The current floating nav backdrop is about 110 px tall. The content also
  // needs the standard 16 px page gap so the final row is fully scrollable
  // above it instead of stopping against or underneath the nav.
  expect(contentStyle.paddingBottom).toBeGreaterThanOrEqual(126)
})
