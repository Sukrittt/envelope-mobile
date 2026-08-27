import { fireEvent, waitFor } from '@testing-library/react-native'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import { getExpenses, deleteExpense } from '@/src/api/expenses'
import { getBudgets } from '@/src/api/budgets'
import { getCategories } from '@/src/api/categories'
import { getGroups } from '@/src/api/groups'
import ExpenseAddedScreen, { ENVELOPE_DELAY } from './expense-added'

jest.mock('@/src/api/expenses', () => ({
  getExpenses: jest.fn(),
  addExpense: jest.fn(),
  updateExpense: jest.fn(),
  deleteExpense: jest.fn(),
}))
jest.mock('@/src/api/budgets', () => ({
  getBudgets: jest.fn(),
  addBudget: jest.fn(),
  updateBudget: jest.fn(),
  deleteBudget: jest.fn(),
}))
jest.mock('@/src/api/categories', () => ({
  getCategories: jest.fn(),
  addCategory: jest.fn(),
  updateCategory: jest.fn(),
  deleteCategory: jest.fn(),
  moveCategory: jest.fn(),
}))
jest.mock('@/src/api/groups', () => ({
  getGroups: jest.fn(),
  addGroup: jest.fn(),
  updateGroup: jest.fn(),
  deleteGroup: jest.fn(),
  moveGroup: jest.fn(),
}))
jest.mock('expo-audio', () => ({ useAudioPlayer: () => ({ play: jest.fn(), pause: jest.fn() }) }))

// `mock`-prefixed so Jest's out-of-scope guard allows the factory to close over them.
const mockReplace = jest.fn()
let mockParams: Record<string, string> = {}
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), push: jest.fn(), navigate: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}))

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// computeEnvelopeState only counts expenses in the *current* month, so the
// fixture has to move with the clock rather than pin a date.
const MONTH = new Date().toISOString().slice(0, 7)
const TODAY = `${MONTH}-15`
const MONTH_LABEL = MONTHS[Number(MONTH.slice(5)) - 1]
const YEAR2 = MONTH.slice(2, 4)

const BASE_PARAMS = {
  id: 'abc123',
  timestamp: `${TODAY}T01:24:00`,
  item: 'Milk',
  amount: '450',
  category: '🛒 Groceries',
  date: TODAY,
  notes: '',
  paymentMethod: 'bank',
}

function setup(overrides: Partial<typeof BASE_PARAMS> = {}, expenses: object[] = []) {
  mockParams = { ...BASE_PARAMS, ...overrides }
  ;(getExpenses as jest.Mock).mockResolvedValue(expenses)
  ;(getBudgets as jest.Mock).mockResolvedValue([
    { month: MONTH, category: '🛒 Groceries', assigned: '8000', rolled_over: '0' },
  ])
  ;(getCategories as jest.Mock).mockResolvedValue([{ name: '🛒 Groceries', group: 'Food' }])
  ;(getGroups as jest.Mock).mockResolvedValue(['Food'])
  return renderWithProviders(<ExpenseAddedScreen />)
}

beforeEach(() => {
  jest.clearAllMocks()
})

const SLOW = { timeout: ENVELOPE_DELAY + 1500 }

it('reads back the amount, category and time of what was just logged', async () => {
  const { getByLabelText, getByText } = setup()
  // The amount animates, so the full string only exists on the odometer's label.
  expect(getByLabelText('₹450')).toBeTruthy()
  expect(getByText('Milk · 🛒 Groceries')).toBeTruthy()
  expect(getByText(`15 ${MONTH_LABEL} '${YEAR2}, 1:24 am`)).toBeTruthy()
  await waitFor(() => expect(getGroups).toHaveBeenCalled())
})

// An item named after its own category ("Groceries" in "🛒 Groceries") would
// otherwise print the same word twice.
it('collapses the detail line when the item is named after its category', async () => {
  const { getByText, queryByText } = setup({ item: 'groceries' })
  expect(getByText('🛒 Groceries')).toBeTruthy()
  expect(queryByText('groceries · 🛒 Groceries')).toBeNull()
  await waitFor(() => expect(getGroups).toHaveBeenCalled())
})

// The envelope is a second beat, not part of the receipt: it lands after the
// column has had the screen to itself.
it('holds the envelope back until the receipt has landed', async () => {
  const { queryByText, getByText } = setup()
  expect(queryByText('left in Groceries')).toBeNull()
  await waitFor(() => expect(getByText('left in Groceries')).toBeTruthy(), SLOW)
})

// The expenses refetch the mutation triggered may not have landed yet. Both
// branches have to produce the same number, or the envelope balance visibly
// ticks down mid-animation — or worse, double-counts the new expense.
it('charges the envelope by hand while the new expense is missing from the cache', async () => {
  const { getByText } = setup({}, [{ date: TODAY, amount_inr: '1200', category: '🛒 Groceries', timestamp: 'other' }])
  // 8000 assigned - 1200 already spent - 450 not yet in the list = 6350
  await waitFor(() => expect(getByText('₹6,350')).toBeTruthy(), SLOW)
})

it('does not double-charge once the new expense is in the cache', async () => {
  const { getByText } = setup({}, [
    { date: TODAY, amount_inr: '1200', category: '🛒 Groceries', timestamp: 'other' },
    { date: TODAY, amount_inr: '450', category: '🛒 Groceries', timestamp: BASE_PARAMS.timestamp },
  ])
  await waitFor(() => expect(getByText('₹6,350')).toBeTruthy(), SLOW)
})

it('omits the envelope line for a category with no money assigned this month', async () => {
  ;(getBudgets as jest.Mock).mockResolvedValue([])
  const { queryByText } = setup()
  await waitFor(() => expect(getGroups).toHaveBeenCalled())
  expect(queryByText('left in Groceries')).toBeNull()
})

// The POST is the only source of a timestamp on newer servers; older ones return
// none, and the stamp line went blank rather than falling back.
it('falls back to the navigation time when the server returned no timestamp', async () => {
  const { getByText } = setup({ timestamp: '', loggedAt: `${TODAY}T09:05:00` } as never)
  expect(getByText(`15 ${MONTH_LABEL} '${YEAR2}, 9:05 am`)).toBeTruthy()
  await waitFor(() => expect(getGroups).toHaveBeenCalled())
})

it('deletes by id and reopens a prefilled entry screen on undo', async () => {
  ;(deleteExpense as jest.Mock).mockResolvedValue(undefined)
  const { getByText } = setup()
  fireEvent.press(getByText('Undo'))
  await waitFor(() => expect(deleteExpense).toHaveBeenCalledWith('abc123', BASE_PARAMS.timestamp, 'Milk', 450))
  await waitFor(() =>
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/modals/log-expense',
      params: { item: 'Milk', amountInr: '450', category: '🛒 Groceries', date: TODAY, notes: '', paymentMethod: 'bank' },
    }),
  )
})

// Without an id the only way to address the row is a timestamp/item/amount
// triple, which can match a different expense. No Undo beats a wrong delete.
it('hides undo when the server did not return an id', async () => {
  const { queryByText } = setup({ id: '' })
  await waitFor(() => expect(getGroups).toHaveBeenCalled())
  expect(queryByText('Undo')).toBeNull()
})
