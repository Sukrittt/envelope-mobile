import { act, renderHook, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { useCollapsedGroups } from './useCollapsedGroups'

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}))

const get = SecureStore.getItemAsync as jest.Mock
const set = SecureStore.setItemAsync as jest.Mock

beforeEach(() => jest.clearAllMocks())

it('restores the stored collapsed groups on mount', async () => {
  get.mockResolvedValueOnce(JSON.stringify(['Home', 'Food']))
  const { result } = renderHook(() => useCollapsedGroups('home'))

  await waitFor(() => expect(result.current[0].has('Home')).toBe(true))
  expect(get).toHaveBeenCalledWith('mc-collapsed-home')
  expect(result.current[0].has('Food')).toBe(true)
})

it('persists a change under the screen key', async () => {
  const { result } = renderHook(() => useCollapsedGroups('envelopes'))
  await waitFor(() => expect(get).toHaveBeenCalled())

  act(() => result.current[1](new Set(['Food'])))

  await waitFor(() => expect(set).toHaveBeenCalledWith('mc-collapsed-envelopes', JSON.stringify(['Food'])))
})

it('does not overwrite the stored value before it has loaded', async () => {
  get.mockReturnValueOnce(new Promise(() => {}))
  renderHook(() => useCollapsedGroups('home'))

  await act(async () => {})
  expect(set).not.toHaveBeenCalled()
})
