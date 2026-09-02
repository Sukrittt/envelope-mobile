import { accessMode, currentUserId, type AccessMode } from '../api/accessMode'
import { initAnalytics, posthog } from './analytics'

jest.mock('../api/accessMode', () => ({
  accessMode: { subscribe: jest.fn(), subscribeLogout: jest.fn() },
  currentUserId: jest.fn(),
}))

const mockSubscribe = accessMode.subscribe as jest.Mock
const mockSubscribeLogout = accessMode.subscribeLogout as jest.Mock
const mockCurrentUserId = currentUserId as jest.MockedFunction<typeof currentUserId>

function notifyMode(mode: AccessMode): void {
  ;(mockSubscribe.mock.calls[0][0] as (m: AccessMode) => void)(mode)
}

function notifyLogout(): void {
  ;(mockSubscribeLogout.mock.calls[0][0] as () => void)()
}

beforeEach(() => {
  jest.clearAllMocks()
  initAnalytics()
})

describe('initAnalytics', () => {
  it('identifies with the WorkOS user id when a real session appears', () => {
    mockCurrentUserId.mockReturnValue('user_01ABC')
    notifyMode('real')
    expect(posthog.identify).toHaveBeenCalledWith('user_01ABC')
  })

  it('sends no properties alongside the id, so no email or name can leak', () => {
    mockCurrentUserId.mockReturnValue('user_01ABC')
    notifyMode('real')
    expect(posthog.identify).toHaveBeenCalledTimes(1)
    expect((posthog.identify as jest.Mock).mock.calls[0]).toHaveLength(1)
  })

  it('leaves guest sessions anonymous', () => {
    mockCurrentUserId.mockReturnValue(null)
    notifyMode('guest')
    expect(posthog.identify).not.toHaveBeenCalled()
  })

  // clearAccess() notifies subscribers with 'guest' before it runs the logout
  // subscribers, so the mode guard is what stops an identify(null) landing
  // between the two.
  it('does not identify on the guest notification that precedes a logout', () => {
    mockCurrentUserId.mockReturnValue(null)
    notifyMode('guest')
    notifyLogout()
    expect(posthog.identify).not.toHaveBeenCalled()
    expect(posthog.reset).toHaveBeenCalled()
  })

  it('resets on logout, so the next account on the device starts clean', () => {
    notifyLogout()
    expect(posthog.reset).toHaveBeenCalledTimes(1)
  })
})
