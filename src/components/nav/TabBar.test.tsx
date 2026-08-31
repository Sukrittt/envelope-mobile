import { act, fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import { getUser } from '@/src/api/account'
import { getExpenses } from '@/src/api/expenses'
import { publishLogExpenseSubmit, resetLogExpenseSubmit } from '@/src/hooks/useLogExpenseSubmit'
import { TabBar } from './TabBar'

jest.mock('@/src/api/account', () => ({ getUser: jest.fn() }))
jest.mock('@/src/api/expenses', () => ({ getExpenses: jest.fn() }))

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockNavigate = jest.fn()
const mockBack = jest.fn()
let mockPathname = '/'
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, navigate: mockNavigate, back: mockBack }),
  usePathname: () => mockPathname,
}))

const mockGetUser = getUser as jest.Mock
const mockGetExpenses = getExpenses as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  resetLogExpenseSubmit()
  mockPathname = '/'
  mockGetUser.mockResolvedValue({ onboardedAt: '2026-01-01' })
  mockGetExpenses.mockResolvedValue([])
})

it('navigates to log-expense when the add circle is tapped elsewhere', async () => {
  const { getByLabelText } = renderWithProviders(<TabBar />)
  await act(async () => {})
  fireEvent.press(getByLabelText('Log expense'))
  expect(mockPush).toHaveBeenCalledWith('/modals/log-expense')
  expect(mockBack).not.toHaveBeenCalled()
})

describe('on the log-expense screen', () => {
  beforeEach(() => {
    mockPathname = '/modals/log-expense'
  })

  it('submits (not router.back) when the add circle is tapped', async () => {
    const submit = jest.fn()
    act(() => publishLogExpenseSubmit({ canSubmit: true, saving: false, success: false, submit }))

    const { getByLabelText } = renderWithProviders(<TabBar />)
    await act(async () => {})
    fireEvent.press(getByLabelText('Log expense'))

    expect(submit).toHaveBeenCalled()
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('disables the circle and blocks submit while saving', async () => {
    const submit = jest.fn()
    act(() => publishLogExpenseSubmit({ canSubmit: true, saving: true, success: false, submit }))

    const { getByLabelText } = renderWithProviders(<TabBar />)
    await act(async () => {})
    const circle = getByLabelText('Log expense')
    expect(circle.props.accessibilityState.disabled).toBe(true)
    fireEvent.press(circle)
    expect(submit).not.toHaveBeenCalled()
  })

  it('shows "Tap to add expense" when there are no transactions', async () => {
    const { findByText, queryByText } = renderWithProviders(<TabBar />)
    expect(await findByText('Tap to add expense')).toBeTruthy()
    expect(queryByText('Log your first expense here')).toBeNull()
  })

  it('hides the hint once transactions exist', async () => {
    mockGetExpenses.mockResolvedValue([{ item: 'Coffee' }])
    const { findByLabelText, queryByText } = renderWithProviders(<TabBar />)
    await findByLabelText('Log expense')
    expect(queryByText('Tap to add expense')).toBeNull()
  })
})

it('shows the Home-tab hint, not the log-expense one, on Home with no transactions', async () => {
  const { findByText, queryByText } = renderWithProviders(<TabBar />)
  expect(await findByText('Log your first expense here')).toBeTruthy()
  expect(queryByText('Tap to add expense')).toBeNull()
})
