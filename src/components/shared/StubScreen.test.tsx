import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import { StubScreen } from './StubScreen'

// useSafeAreaInsets falls back to a default inset set (via
// react-native-safe-area-context's jest mock) when rendered with no
// SafeAreaProvider ancestor, so no extra wrapping is needed here.

describe('StubScreen', () => {
  it('renders the given title and the static "Coming soon" subtitle', () => {
    const { getByText } = renderWithProviders(<StubScreen title="Investments" />)
    expect(getByText('Investments')).toBeTruthy()
    expect(getByText('Coming soon')).toBeTruthy()
  })
})
