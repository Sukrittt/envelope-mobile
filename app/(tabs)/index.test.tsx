import type { ReactNode } from 'react'
import { Animated } from 'react-native'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/src/theme/ThemeProvider'
import { PrivacyProvider } from '@/src/context/PrivacyContext'
import HomeScreen from './index'

// Bypasses react-query entirely so the test controls exactly when "fresh
// data" becomes visible to Home — mirroring what an invalidateQueries
// refetch does in production, without a real network round trip.
let mockBudgets: { month: string; category: string; assigned: string; rolled_over: string }[] = []

jest.mock('@/src/hooks/useBudgets', () => ({
  useBudgets: () => ({ data: mockBudgets, isLoading: false, error: null }),
  useUpdateBudget: () => ({
    mutateAsync: (params: { month: string; category: string; updates: { assigned: string } }) => {
      mockBudgets = mockBudgets.map((b) =>
        b.month === params.month && b.category === params.category ? { ...b, assigned: params.updates.assigned } : b,
      )
      return Promise.resolve()
    },
  }),
  useAddBudget: () => ({ mutateAsync: () => Promise.resolve() }),
}))
jest.mock('@/src/hooks/useExpenses', () => ({ useExpenses: () => ({ data: [], isLoading: false, error: null }) }))
jest.mock('@/src/hooks/useCategories', () => ({
  useCategories: () => ({ data: [{ name: 'Food', group: 'Everyday' }], isLoading: false, error: null }),
}))
jest.mock('@/src/hooks/useGroups', () => ({ useGroups: () => ({ data: ['Everyday'], isLoading: false, error: null }) }))
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() }),
  useIsFocused: () => true,
}))

describe('HomeScreen — Ready to Assign odometer', () => {
  beforeEach(() => {
    mockBudgets = [
      { month: '2026-08', category: '__income__', assigned: '20000', rolled_over: '0' },
      { month: '2026-08', category: 'Food', assigned: '5000', rolled_over: '0' },
    ]
  })

  it('holds the old value while the edit-amount sheet covers it, then rolls to the new one on close', async () => {
    jest.useFakeTimers()
    const timingSpy = jest.spyOn(Animated, 'timing')

    // A `wrapper` (not renderWithProviders' one-shot JSX wrap) so `rerender`
    // — used below to simulate a background refetch landing mid-edit —
    // re-wraps HomeScreen in the same providers instead of mounting it bare.
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <PrivacyProvider>{children}</PrivacyProvider>
          </ThemeProvider>
        </QueryClientProvider>
      )
    }

    const { getByText, getByLabelText, getByDisplayValue, rerender, queryByLabelText } = render(<HomeScreen />, {
      wrapper: Wrapper,
    })

    // Ready to Assign = 20,000 income - 5,000 assigned to Food.
    expect(getByLabelText('₹15,000')).toBeTruthy()

    fireEvent.press(getByText('Food'))
    fireEvent.press(getByText('Edit assigned amount'))
    fireEvent.changeText(getByDisplayValue('5000'), '8000')

    timingSpy.mockClear()
    await act(async () => {
      fireEvent.press(getByText('Save'))
    })

    // The mutation resolved (budgets now reflects 8,000 assigned, so Ready to
    // Assign is really 12,000) but the sheet is still open showing its
    // checkmark — a background refetch landing right now must not leak the
    // new number onto the still-covered hero.
    rerender(<HomeScreen />)
    expect(getByLabelText('₹15,000')).toBeTruthy()
    expect(queryByLabelText('₹12,000')).toBeNull()
    // The odometer's decreasing roll is the only Animated.timing call in this
    // tree shaped {toValue: 0, useNativeDriver: true} — CheckIcon's draw-on
    // and the tab crossfade use different configs, so this isolates it from
    // their unrelated (and expected) animations.
    const rolled = () => timingSpy.mock.calls.some((c) => c[1]?.toValue === 0 && c[1]?.useNativeDriver === true)
    expect(rolled()).toBe(false)

    // Sheet auto-closes ~1100ms after the checkmark lands.
    await act(async () => {
      jest.advanceTimersByTime(1100)
    })

    await waitFor(() => expect(getByLabelText('₹12,000')).toBeTruthy())
    expect(queryByLabelText('₹15,000')).toBeNull()
    expect(rolled()).toBe(true)

    jest.useRealTimers()
  })
})
