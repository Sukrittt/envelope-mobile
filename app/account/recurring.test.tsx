import { fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import RecurringExpensesScreen from './recurring'
import type { RecurringExpenseRow } from '@/src/types'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), navigate: jest.fn() }),
}))

const mockUseRecurringExpenses = jest.fn()
jest.mock('@/src/hooks/useRecurringExpenses', () => ({
  useRecurringExpenses: () => mockUseRecurringExpenses(),
}))

jest.mock('@/src/lib/netStatus', () => ({ useOnline: () => true }))

function row(overrides: Partial<RecurringExpenseRow>): RecurringExpenseRow {
  return {
    id: 'r1',
    item: 'Rent',
    amount_inr: '25000',
    category: 'Housing',
    notes: '',
    payment_method: 'bank',
    frequency: 'monthly',
    start_date: '2026-09-15',
    end_date: '',
    next_run_date: '2026-09-15',
    status: 'active',
    created_at: '2026-09-07T10:00:00',
    ...overrides,
  }
}

function render(rows: RecurringExpenseRow[]) {
  mockUseRecurringExpenses.mockReturnValue({ data: rows, isLoading: false })
  return renderWithProviders(<RecurringExpensesScreen />)
}

beforeEach(() => {
  mockPush.mockClear()
  mockUseRecurringExpenses.mockReset()
})

describe('empty state', () => {
  it('explains what the screen is for when nothing repeats yet', () => {
    const { getByText } = render([])
    expect(getByText('Nothing repeating yet')).toBeTruthy()
    expect(getByText('Set it once, forget it')).toBeTruthy()
  })
})

describe('header total', () => {
  it('normalizes each cadence to a single monthly figure', () => {
    const { getByText } = render([
      row({ id: 'a', item: 'Rent', amount_inr: '600', frequency: 'monthly' }),
      row({ id: 'b', item: 'Insurance', amount_inr: '1200', frequency: 'yearly' }), // 100/mo
      row({ id: 'c', item: 'Coffee', amount_inr: '10', frequency: 'daily' }), // 300/mo
    ])
    // 600 + 100 + 300 = 1000
    expect(getByText('3 active · about ₹1,000 a month')).toBeTruthy()
  })

  it('leaves paused rows out of the active count and the total', () => {
    const { getByText } = render([
      row({ id: 'a', item: 'Rent', amount_inr: '400', status: 'active' }),
      row({ id: 'b', item: 'Gym', amount_inr: '999', status: 'paused' }),
    ])
    expect(getByText('1 active · about ₹400 a month')).toBeTruthy()
  })
})

describe('rows', () => {
  it('shows the server-computed next run date, cadence and category', () => {
    const { getByText } = render([row({})])
    expect(getByText('Next on 15 Sep')).toBeTruthy()
    expect(getByText('Every month · Housing')).toBeTruthy()
  })

  it('labels a paused row and a finished one instead of a next date', () => {
    const { getByText } = render([
      row({ id: 'a', item: 'Gym', status: 'paused' }),
      row({ id: 'b', item: 'Course', status: 'ended' }),
    ])
    expect(getByText('Paused')).toBeTruthy()
    expect(getByText('Finished')).toBeTruthy()
  })

  it('splits active rows from paused and finished ones', () => {
    const { getByText } = render([
      row({ id: 'a', item: 'Rent', status: 'active' }),
      row({ id: 'b', item: 'Gym', status: 'paused' }),
    ])
    expect(getByText('ACTIVE')).toBeTruthy()
    expect(getByText('PAUSED AND FINISHED')).toBeTruthy()
  })

  it('opens the edit modal for the row that was tapped', () => {
    const { getByText } = render([row({ id: 'r7', item: 'Rent' })])
    fireEvent.press(getByText('Rent'))
    expect(mockPush).toHaveBeenCalledWith('/modals/recurring-expense?id=r7')
  })
})

it('the add button opens the modal with no id, so it starts blank', () => {
  const { getByText } = render([])
  fireEvent.press(getByText('Add'))
  expect(mockPush).toHaveBeenCalledWith('/modals/recurring-expense')
})
