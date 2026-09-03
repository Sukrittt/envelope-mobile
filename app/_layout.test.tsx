import { render, waitFor, act } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import RootLayout from './_layout'
import { initAccessMode } from '@/src/api/accessMode'
import { getUser, type UserProfile } from '@/src/api/account'

// The bug this file guards against: the root layout used to render `null`
// (fonts loading) and then <AppSplash /> (auth resolving) *instead of* the
// Stack. expo-router drops any navigation dispatched in that window and React
// logs "Can't perform a React state update on a component that hasn't mounted
// yet" against ContextNavigator. The navigator must exist on the very first
// render, with route availability driven by Stack.Protected guards instead.

// `mock`-prefixed so Jest's out-of-scope guard allows the factories to close over them.
let mockFontsLoaded = false
jest.mock('@/src/theme/fonts', () => ({
  ...jest.requireActual('@/src/theme/fonts'),
  useAppFonts: () => [mockFontsLoaded],
}))

let mockSegments: string[] = []
const mockPathname = '/'
let mockGlobalParams: Record<string, string> = {}
const mockReplace = jest.fn()
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require('react-native')
  function Stack({ children }: { children: ReactNode }) {
    return <RNView testID="stack">{children}</RNView>
  }
  Stack.Screen = function Screen({ name }: { name: string }) {
    return <RNView testID={`screen:${name}`} />
  }
  Stack.Protected = function Protected({ guard, children }: { guard: boolean; children: ReactNode }) {
    return guard ? <>{children}</> : null
  }
  return {
    Stack,
    useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn(), navigate: jest.fn() }),
    useSegments: () => mockSegments,
    usePathname: () => mockPathname,
    useGlobalSearchParams: () => mockGlobalParams,
  }
})

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}))
jest.mock('expo-audio', () => ({ setAudioModeAsync: jest.fn(() => Promise.resolve()) }))
jest.mock('@/src/lib/notifications', () => ({
  configureNotificationHandler: jest.fn(),
  registerForPushNotificationsAsync: jest.fn(),
  addPushTokenListener: jest.fn(),
  addNotificationResponseListener: jest.fn(),
  checkColdStartNotification: jest.fn(() => Promise.resolve()),
}))
// Pulls in reanimated + the user/expenses queries; irrelevant to route gating.
jest.mock('@/src/components/nav/TabBar', () => ({ TabBar: () => null }))

jest.mock('@/src/api/accessMode', () => ({
  accessMode: { subscribe: () => () => {}, subscribeLogout: () => () => {} },
  initAccessMode: jest.fn(),
  clearAccess: jest.fn(),
  // Read by src/lib/analytics.ts, which this layout calls from inside the
  // getUser() chain that decides onboarding routing.
  currentUserId: jest.fn(() => 'user_test'),
}))
jest.mock('@/src/api/account', () => ({ getUser: jest.fn() }))

const mockInitAccessMode = initAccessMode as jest.MockedFunction<typeof initAccessMode>
const mockGetUser = getUser as jest.MockedFunction<typeof getUser>

beforeEach(() => {
  jest.clearAllMocks()
  mockFontsLoaded = false
  mockSegments = []
  mockGlobalParams = {}
})

describe('RootLayout', () => {
  it('renders the navigator on the first render, before fonts or auth resolve', () => {
    // Never settles: the first render is all this assertion is about.
    mockInitAccessMode.mockReturnValue(new Promise(() => {}))
    mockGetUser.mockReturnValue(new Promise(() => {}))

    const { getByTestId } = render(<RootLayout />)

    expect(getByTestId('stack')).toBeTruthy()
    expect(getByTestId('screen:loading')).toBeTruthy()
  })

  it('swaps loading for the sign-in screen once auth resolves signed out', async () => {
    mockFontsLoaded = true
    mockInitAccessMode.mockResolvedValue(null)
    mockGetUser.mockReturnValue(new Promise(() => {}))

    const { getByTestId, queryByTestId } = render(<RootLayout />)

    await waitFor(() => expect(getByTestId('screen:(auth)/welcome')).toBeTruthy(), { timeout: 3000 })
    expect(queryByTestId('screen:loading')).toBeNull()
    expect(queryByTestId('screen:(tabs)')).toBeNull()
  })

  it('holds on loading while the onboarding flag is still unknown, then opens the tabs', async () => {
    mockFontsLoaded = true
    mockInitAccessMode.mockResolvedValue('real')
    let resolveUser: (u: UserProfile) => void = () => {}
    mockGetUser.mockReturnValue(new Promise<UserProfile>((resolve) => { resolveUser = resolve }))

    const { getByTestId, queryByTestId } = render(<RootLayout />)

    await waitFor(() => expect(getByTestId('screen:loading')).toBeTruthy())
    expect(queryByTestId('screen:(tabs)')).toBeNull()

    await act(async () => {
      resolveUser({ email: 'a@b.com', emailVerified: true, onboardedAt: '2026-01-01T00:00:00.000Z' })
    })

    // `resolving` also gates on MIN_SPLASH_MS's real 2s timer — the default
    // waitFor timeout (1000ms) isn't long enough to outlast it.
    await waitFor(() => expect(getByTestId('screen:(tabs)')).toBeTruthy(), { timeout: 3000 })
    expect(queryByTestId('screen:loading')).toBeNull()
    expect(queryByTestId('screen:setup')).toBeNull()
  })

  it('routes a signed-in user who has not onboarded to setup', async () => {
    mockFontsLoaded = true
    mockInitAccessMode.mockResolvedValue('real')
    mockGetUser.mockResolvedValue({ email: 'a@b.com', emailVerified: true, onboardedAt: null })

    const { getByTestId, queryByTestId } = render(<RootLayout />)

    await waitFor(() => expect(getByTestId('screen:setup')).toBeTruthy(), { timeout: 3000 })
    expect(queryByTestId('screen:(tabs)')).toBeNull()
  })

  // (auth)/email and (auth)/code stay registered while signed in for the
  // change-email flow, so signing in from them removes no screen — the root
  // layout has to move the user off explicitly.
  it('moves a user who just signed in on an auth screen to the tabs', async () => {
    mockFontsLoaded = true
    mockSegments = ['(auth)', 'code']
    mockInitAccessMode.mockResolvedValue('real')
    mockGetUser.mockResolvedValue({ email: 'a@b.com', emailVerified: true, onboardedAt: '2026-01-01T00:00:00.000Z' })

    render(<RootLayout />)

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)'), { timeout: 3000 })
  })

  it('sends a signed-in user who has not onboarded from an auth screen to setup', async () => {
    mockFontsLoaded = true
    mockSegments = ['(auth)', 'code']
    mockInitAccessMode.mockResolvedValue('real')
    mockGetUser.mockResolvedValue({ email: 'a@b.com', emailVerified: true, onboardedAt: null })

    render(<RootLayout />)

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/setup'), { timeout: 3000 })
  })

  it('leaves a change-email flow alone', async () => {
    mockFontsLoaded = true
    mockSegments = ['(auth)', 'code']
    mockGlobalParams = { mode: 'change-email' }
    mockInitAccessMode.mockResolvedValue('real')
    mockGetUser.mockResolvedValue({ email: 'a@b.com', emailVerified: true, onboardedAt: '2026-01-01T00:00:00.000Z' })

    const { getByTestId } = render(<RootLayout />)

    await waitFor(() => expect(getByTestId('screen:(tabs)')).toBeTruthy(), { timeout: 3000 })
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
