import { fireEvent, waitFor } from '@testing-library/react-native'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import { useUser } from '@/src/hooks/useUser'
import { useWrappedStatus } from '@/src/hooks/useWrapped'
import { clearAccess, sessionId } from '@/src/api/accessMode'
import { revokeSession } from '@/src/api/account'
import MoreScreen from './more'

jest.mock('@/src/hooks/useUser', () => ({ useUser: jest.fn() }))
jest.mock('@/src/hooks/useWrapped', () => ({ useWrappedStatus: jest.fn() }))
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useIsFocused: () => true,
}))
jest.mock('@/src/api/accessMode', () => ({
  clearAccess: jest.fn(() => Promise.resolve()),
  sessionId: jest.fn(() => 'session_1'),
  accessMode: { subscribe: () => () => {}, subscribeLogout: () => () => {} },
}))
jest.mock('@/src/api/account', () => ({ revokeSession: jest.fn(() => Promise.resolve()) }))

const mockUseUser = useUser as jest.Mock
const mockUseWrappedStatus = useWrappedStatus as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  ;(sessionId as jest.Mock).mockReturnValue('session_1')
  ;(clearAccess as jest.Mock).mockResolvedValue(undefined)
  mockUseUser.mockReturnValue({ data: { email: 'a@b.com', emailVerified: true } })
  mockUseWrappedStatus.mockReturnValue({
    data: { month: '2026-08', transactionCount: 14, available: true, minTransactions: 10 },
  })
})

describe('More tab — Expense Wrapped row', () => {
  it('is dimmed and inert below the transaction threshold, naming the evaluated month', () => {
    mockUseWrappedStatus.mockReturnValue({
      data: { month: '2026-08', transactionCount: 3, available: false, minTransactions: 10 },
    })
    const { getByText } = renderWithProviders(<MoreScreen />)
    expect(getByText('August had 3 of the 10 needed')).toBeTruthy()
  })

  it('is live with the month label once the threshold is met', () => {
    mockUseWrappedStatus.mockReturnValue({
      data: { month: '2026-08', transactionCount: 14, available: true, minTransactions: 10 },
    })
    const { getByText } = renderWithProviders(<MoreScreen />)
    expect(getByText('Your August 2026, wrapped')).toBeTruthy()
  })
})

describe('More tab — Sign out', () => {
  it('shows a pending label and revokes server-side before clearing locally', async () => {
    let releaseRevoke: () => void = () => {}
    ;(revokeSession as jest.Mock).mockReturnValue(
      new Promise<void>((resolve) => {
        releaseRevoke = resolve
      }),
    )

    const { getByText, queryByText } = renderWithProviders(<MoreScreen />)
    fireEvent.press(getByText('Sign out'))

    // Still in flight: the button says so and the local session is untouched.
    await waitFor(() => expect(getByText('Signing out…')).toBeTruthy())
    expect(queryByText('Sign out')).toBeNull()
    expect(revokeSession).toHaveBeenCalledWith('session_1')
    expect(clearAccess).not.toHaveBeenCalled()

    releaseRevoke()
    await waitFor(() => expect(clearAccess).toHaveBeenCalled())
  })

  it('is inert while a sign-out is already in flight', async () => {
    ;(revokeSession as jest.Mock).mockReturnValue(new Promise<void>(() => {}))

    const { getByText } = renderWithProviders(<MoreScreen />)
    fireEvent.press(getByText('Sign out'))
    await waitFor(() => expect(getByText('Signing out…')).toBeTruthy())

    fireEvent.press(getByText('Signing out…'))
    expect(revokeSession).toHaveBeenCalledTimes(1)
  })
})
