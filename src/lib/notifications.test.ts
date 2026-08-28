import { addNotificationResponseListener, checkColdStartNotification } from './notifications'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }))
jest.mock('@/src/api/notifications', () => ({ registerPushToken: jest.fn() }))

let responseListener: ((response: unknown) => void) | undefined
const mockAddNotificationResponseReceivedListener = jest.fn((cb: (response: unknown) => void) => {
  responseListener = cb
  return { remove: jest.fn() }
})
const mockGetLastNotificationResponseAsync = jest.fn()
const mockClearLastNotificationResponseAsync = jest.fn()

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: mockAddNotificationResponseReceivedListener,
  addPushTokenListener: jest.fn(),
  getLastNotificationResponseAsync: mockGetLastNotificationResponseAsync,
  clearLastNotificationResponseAsync: mockClearLastNotificationResponseAsync,
}))

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'standalone', expoConfig: { extra: { eas: { projectId: 'p' } } } },
  ExecutionEnvironment: { StoreClient: 'storeClient' },
}))

describe('notification tap routing', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockGetLastNotificationResponseAsync.mockClear()
    mockClearLastNotificationResponseAsync.mockClear()
  })

  it('deep-links to the activity tab for a warm tap with a date', () => {
    addNotificationResponseListener()
    expect(responseListener).toBeDefined()

    responseListener!({ notification: { request: { content: { data: { date: '2026-08-20' } } } } })

    expect(mockPush).toHaveBeenCalledWith('/(tabs)/activity?date=2026-08-20')
  })

  it('does nothing for a warm tap with no date', () => {
    addNotificationResponseListener()
    responseListener!({ notification: { request: { content: { data: {} } } } })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('deep-links to an explicit route for a warm tap with data.route', () => {
    addNotificationResponseListener()
    responseListener!({ notification: { request: { content: { data: { route: '/wrapped' } } } } })
    expect(mockPush).toHaveBeenCalledWith('/wrapped')
  })

  it('prefers data.route over data.date when both are present', () => {
    addNotificationResponseListener()
    responseListener!({ notification: { request: { content: { data: { route: '/wrapped', date: '2026-08-20' } } } } })
    expect(mockPush).toHaveBeenCalledWith('/wrapped')
    expect(mockPush).not.toHaveBeenCalledWith('/(tabs)/activity?date=2026-08-20')
  })

  it('deep-links from a cold-start tap and clears the response so it does not re-fire', async () => {
    mockGetLastNotificationResponseAsync.mockResolvedValueOnce({
      notification: { request: { content: { data: { date: '2026-08-21' } } } },
    })

    await checkColdStartNotification()

    expect(mockPush).toHaveBeenCalledWith('/(tabs)/activity?date=2026-08-21')
    expect(mockClearLastNotificationResponseAsync).toHaveBeenCalled()
  })

  it('deep-links to an explicit route from a cold-start tap', async () => {
    mockGetLastNotificationResponseAsync.mockResolvedValueOnce({
      notification: { request: { content: { data: { route: '/wrapped' } } } },
    })

    await checkColdStartNotification()

    expect(mockPush).toHaveBeenCalledWith('/wrapped')
  })

  it('does nothing when there is no queued cold-start response', async () => {
    mockGetLastNotificationResponseAsync.mockResolvedValueOnce(null)

    await checkColdStartNotification()

    expect(mockPush).not.toHaveBeenCalled()
    expect(mockClearLastNotificationResponseAsync).not.toHaveBeenCalled()
  })
})
