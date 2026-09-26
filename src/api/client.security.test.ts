import { apiFetch } from './client'
import { getValidToken, sessionGeneration } from './accessMode'
jest.mock('./accessMode', () => ({
  getValidToken: jest.fn(), sessionGeneration: jest.fn(() => 1),
  SessionChangedError: class extends Error {}, currentAccessToken: jest.fn(), clearAccess: jest.fn(),
}))
jest.mock('@/src/lib/netStatus', () => ({ setOnline: jest.fn(), markSynced: jest.fn() }))
beforeEach(() => jest.clearAllMocks())
it('never sends a guest request when refreshing a real session fails', async () => {
  const fetch = jest.spyOn(global, 'fetch')
  ;(getValidToken as jest.Mock).mockRejectedValueOnce(new Error('refresh unavailable'))
  await expect(apiFetch('/api/expenses')).rejects.toThrow('refresh unavailable')
  expect(fetch).not.toHaveBeenCalled()
  fetch.mockRestore()
})
it('does not send a request after identity changes while resolving credentials', async () => {
  const fetch = jest.spyOn(global, 'fetch')
  ;(sessionGeneration as jest.Mock).mockReturnValueOnce(1).mockReturnValueOnce(1).mockReturnValue(2)
  ;(getValidToken as jest.Mock).mockResolvedValue('old')
  await expect(apiFetch('/api/expenses')).rejects.toThrow()
  expect(fetch).not.toHaveBeenCalled()
  fetch.mockRestore()
})
