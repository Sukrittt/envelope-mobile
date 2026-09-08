import { act, renderHook, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { useRecentCategories } from './useRecentCategories'

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}))

let logoutHandler: (() => void) | null = null
jest.mock('@/src/api/accessMode', () => ({
  accessMode: {
    subscribeLogout: (fn: () => void) => {
      logoutHandler = fn
      return () => { logoutHandler = null }
    },
  },
}))

const get = SecureStore.getItemAsync as jest.Mock
const set = SecureStore.setItemAsync as jest.Mock
const del = SecureStore.deleteItemAsync as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  logoutHandler = null
})

it('restores the stored recents on mount', async () => {
  get.mockResolvedValueOnce(JSON.stringify(['Fuel', 'Food']))
  const { result } = renderHook(() => useRecentCategories())

  await waitFor(() => expect(result.current.recents).toEqual(['Fuel', 'Food']))
  expect(get).toHaveBeenCalledWith('mc-recent-categories')
})

it('records a pick at the front and persists it', async () => {
  const { result } = renderHook(() => useRecentCategories())
  await waitFor(() => expect(get).toHaveBeenCalled())

  act(() => result.current.record('Groceries'))

  await waitFor(() => expect(result.current.recents).toEqual(['Groceries']))
  expect(set).toHaveBeenCalledWith('mc-recent-categories', JSON.stringify(['Groceries']))
})

it('clears recents on logout so the next account starts fresh', async () => {
  get.mockResolvedValueOnce(JSON.stringify(['Food']))
  const { result } = renderHook(() => useRecentCategories())
  await waitFor(() => expect(result.current.recents).toEqual(['Food']))

  act(() => logoutHandler?.())

  await waitFor(() => expect(result.current.recents).toEqual([]))
  expect(del).toHaveBeenCalledWith('mc-recent-categories')
})
