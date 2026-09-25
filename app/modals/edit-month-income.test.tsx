import { act, fireEvent, waitFor } from '@testing-library/react-native'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import { getBudgets, updateBudget } from '@/src/api/budgets'
import EditMonthIncomeModal from './edit-month-income'

jest.mock('@/src/api/budgets', () => ({
  getBudgets: jest.fn(),
  addBudget: jest.fn(),
  updateBudget: jest.fn(),
  deleteBudget: jest.fn(),
  transferBudget: jest.fn(),
}))

const mockBack = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn(), navigate: jest.fn() }),
  useLocalSearchParams: () => ({ month: '2026-07' }),
}))

beforeEach(() => {
  jest.clearAllMocks()
  ;(updateBudget as jest.Mock).mockResolvedValue({})
})

function typeAmount(getByLabelText: (t: string) => any, amount: string) {
  for (const digit of amount) fireEvent.press(getByLabelText(digit))
}

it('creates the income row for a past month that has none', async () => {
  ;(getBudgets as jest.Mock).mockResolvedValue([])
  const { getByLabelText, getByText } = renderWithProviders(<EditMonthIncomeModal />)
  await waitFor(() => expect(getBudgets).toHaveBeenCalled())
  expect(getByText('What came in during July 2026')).toBeTruthy()

  typeAmount(getByLabelText, '85000')
  await act(async () => {
    fireEvent.press(getByText('Save'))
  })
  expect(updateBudget).toHaveBeenCalledWith('2026-07', '__income__', { assigned: '85000' }, 0)
})

it('updates an existing zero income row with its version', async () => {
  ;(getBudgets as jest.Mock).mockResolvedValue([
    { month: '2026-07', category: '__income__', assigned: '0', rolled_over: '0', version: 2 },
  ])
  const { getByLabelText, getByText } = renderWithProviders(<EditMonthIncomeModal />)
  await waitFor(() => expect(getBudgets).toHaveBeenCalled())
  typeAmount(getByLabelText, '5')
  await act(async () => {
    fireEvent.press(getByText('Save'))
  })
  expect(updateBudget).toHaveBeenCalledWith('2026-07', '__income__', { assigned: '5' }, 2)
})

it('does not save an empty amount', async () => {
  ;(getBudgets as jest.Mock).mockResolvedValue([])
  const { getByText } = renderWithProviders(<EditMonthIncomeModal />)
  await act(async () => {
    fireEvent.press(getByText('Save'))
  })
  expect(updateBudget).not.toHaveBeenCalled()
})
