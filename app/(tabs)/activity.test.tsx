import type { ReactNode } from 'react'
import { fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import type { ExpensesPage, ExpensesPageParams } from '@/src/api/expenses'
import ActivityScreen from './activity'

const mockUseExpensesPage = jest.fn()

jest.mock('@/src/hooks/useExpenses', () => ({
  useExpensesPage: (params: ExpensesPageParams) => mockUseExpensesPage(params),
  useDeleteExpense: () => ({ mutate: jest.fn() }),
  // CategoryPickerSheet (rendered inside a BottomSheet) reads the base,
  // unpaginated hook for its autosuggest word map — unrelated to this
  // screen's own paginated fetch, so a static empty result is enough.
  useExpenses: () => ({ data: [], isLoading: false, error: null }),
}))

jest.mock('@/src/hooks/useCategories', () => ({
  useCategories: () => ({ data: [], isLoading: false, error: null }),
}))

jest.mock('@/src/hooks/useGroups', () => ({
  useGroups: () => ({ data: [], isLoading: false, error: null }),
}))

jest.mock('@/src/lib/netStatus', () => ({ useOnline: () => true }))

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
  useIsFocused: () => true,
}))

// SwipeableRow imports react-native-gesture-handler/ReanimatedSwipeable
// directly, which needs a native worklets module unavailable under Jest.
// jest.setup.js's global gesture-handler mock doesn't cover this submodule.
// Swipe behavior is verified by hand elsewhere (RNTL can't simulate a drag
// anyway) — this test only cares about the row's content and pagination.
jest.mock('@/src/components/activity/SwipeableRow', () => ({
  SwipeableRow: ({ children }: { children: ReactNode }) => children,
}))

function row(index: number, date: string): {
  id: string
  timestamp: string
  date: string
  item: string
  amount_inr: string
  category: string
  notes: string
  source: string
  amount: string
  description: string
  payment_method: string
} {
  return {
    id: `row-${index}`,
    timestamp: `${date}T10:00:00`,
    date,
    item: `Item ${index}`,
    amount_inr: '100',
    category: 'Food',
    notes: '',
    source: '',
    amount: '100',
    description: '',
    payment_method: 'bank',
  }
}

function pageResult(overrides: Partial<ExpensesPage>): ExpensesPage {
  return {
    rows: [row(1, '2026-06-01')],
    total: 1,
    page: 1,
    pageCount: 1,
    totalAmount: 100,
    ...overrides,
  }
}

beforeEach(() => {
  mockUseExpensesPage.mockReset()
})

it('shows the server-reported total and spend, with no pagination row for a single page', () => {
  mockUseExpensesPage.mockImplementation((params: ExpensesPageParams) => ({
    data:
      params.limit === 1
        ? pageResult({ rows: [row(1, '2026-06-01')] })
        : pageResult({
            rows: [row(1, '2026-06-01'), row(2, '2026-06-02')],
            total: 2,
            totalAmount: 300,
          }),
    isLoading: false,
    error: null,
  }))

  const { getByText, queryByLabelText } = renderWithProviders(<ActivityScreen />)

  expect(getByText('2 transactions')).toBeTruthy()
  expect(getByText('Total: ₹300')).toBeTruthy()
  expect(queryByLabelText('Next page')).toBeNull()
})

it('pages through the Activity list via server-side pagination', () => {
  mockUseExpensesPage.mockImplementation((params: ExpensesPageParams) => {
    if (params.limit === 1) return { data: pageResult({}), isLoading: false, error: null }
    const page = params.page
    return {
      data: pageResult({
        rows: [row(page, `2026-06-0${page}`)],
        total: 3,
        page,
        pageCount: 3,
        totalAmount: 300,
      }),
      isLoading: false,
      error: null,
    }
  })

  const { getByText, getByLabelText } = renderWithProviders(<ActivityScreen />)

  expect(getByText('Page 1 of 3')).toBeTruthy()
  expect(getByLabelText('Previous page').props.accessibilityState.disabled).toBe(true)

  fireEvent.press(getByLabelText('Next page'))

  expect(getByText('Page 2 of 3')).toBeTruthy()
  expect(getByLabelText('Previous page').props.accessibilityState.disabled).toBe(false)
})
