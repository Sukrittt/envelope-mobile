import { fireEvent, waitFor } from '@testing-library/react-native'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import { getExpenses } from '@/src/api/expenses'
import { getBudgets, addBudget, updateBudget } from '@/src/api/budgets'
import { getCategories } from '@/src/api/categories'
import { getGroups } from '@/src/api/groups'
import MoveMoneyModal from './move-money'
import { currentMonthKey } from '@/src/lib/envelope'

jest.mock('@/src/api/expenses', () => ({ getExpenses: jest.fn() }))
jest.mock('@/src/api/budgets', () => ({
  getBudgets: jest.fn(),
  addBudget: jest.fn(),
  updateBudget: jest.fn(),
  deleteBudget: jest.fn(),
}))
jest.mock('@/src/api/categories', () => ({ getCategories: jest.fn() }))
jest.mock('@/src/api/groups', () => ({ getGroups: jest.fn() }))

const mockBack = jest.fn()
let mockParams: Record<string, string> = {}
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn(), navigate: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}))

const MONTH = currentMonthKey()

// Electricity (the target) is topped up from three envelopes with different
// available/assigned ratios, so ranking order is unambiguous: Travel (90%
// left) > Cook (50% left) > Shopping (10% left).
function setup(overrides: Partial<typeof BASE_PARAMS> = {}) {
  mockParams = { ...BASE_PARAMS, ...overrides }
  ;(getExpenses as jest.Mock).mockResolvedValue([])
  ;(getBudgets as jest.Mock).mockResolvedValue([
    { month: MONTH, category: 'Electricity', assigned: '0', rolled_over: '0' },
    { month: MONTH, category: 'Travel', assigned: '1000', rolled_over: '0' },
    { month: MONTH, category: 'Cook', assigned: '1000', rolled_over: '0' },
    { month: MONTH, category: 'Shopping', assigned: '1000', rolled_over: '0' },
  ])
  ;(getCategories as jest.Mock).mockResolvedValue([
    { name: 'Electricity', group: 'Bills' },
    { name: 'Travel', group: 'Fun' },
    { name: 'Cook', group: 'Food' },
    { name: 'Shopping', group: 'Fun' },
  ])
  ;(getGroups as jest.Mock).mockResolvedValue(['Bills', 'Fun', 'Food'])
  return renderWithProviders(<MoveMoneyModal />)
}

const BASE_PARAMS = { fromCategory: 'Electricity' }

beforeEach(() => {
  jest.clearAllMocks()
})

// Spending eats into each envelope so `available/assigned` differs: Travel
// 900/1000, Cook 500/1000, Shopping 100/1000.
function withSpending() {
  ;(getExpenses as jest.Mock).mockResolvedValue([
    { date: `${MONTH}-05`, amount_inr: '100', category: 'Travel' },
    { date: `${MONTH}-05`, amount_inr: '500', category: 'Cook' },
    { date: `${MONTH}-05`, amount_inr: '900', category: 'Shopping' },
  ])
}

// The numpad's own digit keys share exact text ("0", "5", ...) with the
// odometer's per-character digit nodes on the same screen, so pressing by
// text is ambiguous — the numpad key's accessibilityLabel is the one thing
// that's unique to it.
async function enterAmount(getByLabelText: (t: string) => any, amount: string) {
  for (const digit of amount) {
    fireEvent.press(getByLabelText(digit))
  }
}

it('advances to the sources step once an amount is entered', async () => {
  const { getByText, getByLabelText, queryByText } = setup()
  // The screen gates on an ActivityIndicator until all four queries settle —
  // wait for real content (the numpad) rather than just the mock call.
  await waitFor(() => expect(getByLabelText('1')).toBeTruthy())
  expect(getByText('Add an amount')).toBeTruthy()
  await enterAmount(getByLabelText, '500')
  fireEvent.press(getByText('Pick sources →'))
  await waitFor(() => expect(queryByText('Pick sources →')).toBeNull())
  expect(getByText('SUGGESTED SOURCES')).toBeTruthy()
})

it('auto-fill allocates from the safest sources until the amount is covered', async () => {
  withSpending()
  const { getByText, getByLabelText, queryByText } = setup()
  // The screen gates on an ActivityIndicator until all four queries settle —
  // wait for real content (the numpad) rather than just the mock call.
  await waitFor(() => expect(getByLabelText('1')).toBeTruthy())
  await enterAmount(getByLabelText, '1000')
  fireEvent.press(getByText('Pick sources →'))
  await waitFor(() => expect(getByText('SUGGESTED SOURCES')).toBeTruthy())

  fireEvent.press(getByText('Auto-fill'))

  // 1000 needed: Travel gives 900 (its full available), Cook covers the last 100.
  await waitFor(() => expect(getByText('FROM')).toBeTruthy())
  expect(getByText('Travel')).toBeTruthy()
  expect(getByText('Cook')).toBeTruthy()
  expect(queryByText('Shopping')).toBeTruthy() // still in the remaining pool, untouched
  expect(getByText('Move ₹1,000')).toBeTruthy()
})

it('splits a move across multiple sources on submit', async () => {
  withSpending()
  ;(addBudget as jest.Mock).mockResolvedValue({})
  ;(updateBudget as jest.Mock).mockResolvedValue({})
  const { getByText, getByLabelText } = setup()
  // The screen gates on an ActivityIndicator until all four queries settle —
  // wait for real content (the numpad) rather than just the mock call.
  await waitFor(() => expect(getByLabelText('1')).toBeTruthy())
  await enterAmount(getByLabelText, '1000')
  fireEvent.press(getByText('Pick sources →'))
  await waitFor(() => expect(getByText('SUGGESTED SOURCES')).toBeTruthy())

  fireEvent.press(getByText('Auto-fill'))
  await waitFor(() => expect(getByText('Move ₹1,000')).toBeTruthy())
  fireEvent.press(getByText('Move ₹1,000'))

  // Electricity already has an explicit row this month (assigned: '0'), so
  // its move is an update, not an add: +1000. Travel gives its full 900
  // available; Cook covers the remaining 100.
  await waitFor(() => expect(updateBudget).toHaveBeenCalledWith(MONTH, 'Electricity', { assigned: '1000' }))
  expect(updateBudget).toHaveBeenCalledWith(MONTH, 'Travel', { assigned: '100' })
  expect(updateBudget).toHaveBeenCalledWith(MONTH, 'Cook', { assigned: '900' })
})

it('filters the source list by search', async () => {
  withSpending()
  const { getByText, getByLabelText, getByPlaceholderText, queryByText } = setup()
  // The screen gates on an ActivityIndicator until all four queries settle —
  // wait for real content (the numpad) rather than just the mock call.
  await waitFor(() => expect(getByLabelText('1')).toBeTruthy())
  await enterAmount(getByLabelText, '500')
  fireEvent.press(getByText('Pick sources →'))
  await waitFor(() => expect(getByText('SUGGESTED SOURCES')).toBeTruthy())

  fireEvent.changeText(getByPlaceholderText('Find an envelope'), 'trav')
  expect(getByText('Travel')).toBeTruthy()
  expect(queryByText('Cook')).toBeNull()
  expect(queryByText('Shopping')).toBeNull()
})
