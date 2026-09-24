/**
 * The offline picker's whole promise: a list cached during one app run is
 * still there after the app is killed and reopened with no network. Exercises
 * the real encryptedStorage + accessMode path (only the two device stores are
 * faked), because every part of that chain — the AES key in SecureStore, the
 * uid the key is namespaced by, the blob in AsyncStorage — has to survive a
 * restart for the cache to be worth anything.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- This restart test reloads modules after jest.resetModules(). */
// Both stores survive jest.resetModules(), the way device storage survives an
// app restart — only the JS context is new.
jest.mock('@react-native-async-storage/async-storage', () => {
  const disk: Record<string, string> = ((globalThis as Record<string, any>).__disk ??= {})
  return { __esModule: true, default: {
    getItem: async (k: string) => disk[k] ?? null,
    setItem: async (k: string, v: string) => { disk[k] = v },
    removeItem: async (k: string) => { delete disk[k] },
    getAllKeys: async () => Object.keys(disk),
    multiRemove: async (keys: string[]) => { keys.forEach((k) => delete disk[k]) },
  } }
})
jest.mock('expo-secure-store', () => {
  const store: Record<string, string> = ((globalThis as Record<string, any>).__keystore ??= {})
  return {
    getItemAsync: async (k: string) => store[k] ?? null,
    setItemAsync: async (k: string, v: string) => { store[k] = v },
    deleteItemAsync: async (k: string) => { delete store[k] },
  }
})

const DISK: Record<string, string> = ((globalThis as Record<string, any>).__disk ??= {})
const KEYSTORE: Record<string, string> = ((globalThis as Record<string, any>).__keystore ??= {})

function fakeToken(sub = 'user_1', exp = 9_999_999_999): string {
  const payload = Buffer.from(JSON.stringify({ sub, sid: 'session_1', exp })).toString('base64')
  return `header.${payload}.signature`
}

const rows = [{ name: 'Rent', group: 'Home' }]

it('a cache written in one run is readable after a restart', async () => {
  // Run 1: signed in, categories fetched, cache written.
  KEYSTORE['mc-session'] = JSON.stringify({ accessToken: fakeToken(), refreshToken: 'r1', expiresAt: Date.now() + 3_600_000 })
  let mod = require('@/src/lib/categoryCache')
  let access = require('@/src/api/accessMode')
  await access.initAccessMode()
  await mod.writeCategoryCache(rows)
  expect(DISK['mc-category-cache:user_1']).toBeTruthy()

  // Run 2: fresh JS context (restart), same disk.
  jest.resetModules()
  mod = require('@/src/lib/categoryCache')
  access = require('@/src/api/accessMode')
  // An expired access token, as after the app has been closed a while.
  KEYSTORE['mc-session'] = JSON.stringify({ accessToken: fakeToken('user_1', Math.floor(Date.now() / 1000) - 60), refreshToken: 'r1', expiresAt: Date.now() - 60_000 })
  await access.initAccessMode()
  expect(await mod.readCategoryCache()).toEqual(rows)
})
