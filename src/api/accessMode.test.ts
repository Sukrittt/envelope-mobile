import * as SecureStore from 'expo-secure-store'
import { accessMode, clearAccess, currentAccessToken, persistSession } from './accessMode'

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}))

/** A JWT-shaped token whose payload carries a `sid`, so sessionId() resolves. */
function fakeToken(): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: 'user_1', sid: 'session_1', exp: 9_999_999_999 }),
  ).toString('base64')
  return `header.${payload}.signature`
}

beforeEach(() => {
  jest.clearAllMocks()
})

it('clearAccess drops the session locally without any network call', async () => {
  const fetchSpy = jest.spyOn(global, 'fetch')
  await persistSession({ accessToken: fakeToken(), refreshToken: 'r1', expiresAt: Date.now() + 3_600_000 })
  expect(currentAccessToken()).not.toBeNull()

  await clearAccess()

  expect(currentAccessToken()).toBeNull()
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('mc-session')
  // Regression guard: ending the WorkOS session is the caller's job (revokeSession).
  // The hosted-logout ping that used to live here is a browser redirect endpoint —
  // RN's fetch throws following it, which reported every sign-out as a failure.
  expect(fetchSpy).not.toHaveBeenCalled()
  fetchSpy.mockRestore()
})

it('clearAccess notifies logout subscribers', async () => {
  const onLogout = jest.fn()
  const unsubscribe = accessMode.subscribeLogout(onLogout)

  await persistSession({ accessToken: fakeToken(), refreshToken: 'r1', expiresAt: Date.now() + 3_600_000 })
  await clearAccess()

  expect(onLogout).toHaveBeenCalledTimes(1)
  unsubscribe()
})
