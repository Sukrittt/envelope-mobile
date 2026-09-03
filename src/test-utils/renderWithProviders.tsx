import type { ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react-native'
import { ThemeProvider } from '@/src/theme/ThemeProvider'
import { PrivacyProvider } from '@/src/context/PrivacyContext'
import { TabSwipeProvider } from '@/src/components/nav/TabSwipeContext'

/**
 * Wraps a component in the context layers it actually reads from
 * (QueryClient/Theme/Privacy/TabSwipe) — skips app-shell providers from
 * app/_layout.tsx (GestureHandlerRootView, SafeAreaProvider,
 * RootNavigator), which are not a unit test's concern. TabSwipeProvider is
 * included because every tab screen's body goes through AnimatedTabContent,
 * which reads useTabSwipe() and throws outright without an ancestor.
 */
export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <PrivacyProvider>
          <TabSwipeProvider>{ui}</TabSwipeProvider>
        </PrivacyProvider>
      </ThemeProvider>
    </QueryClientProvider>,
    options,
  )
}
