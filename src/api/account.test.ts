import { apiFetch } from './client'
import { getUser, updateUser, changeEmail } from './account'

jest.mock('./client', () => ({
  apiFetch: jest.fn(),
}))

const mockedApiFetch = apiFetch as jest.Mock

beforeEach(() => {
  mockedApiFetch.mockReset()
})

describe('getUser / updateUser', () => {
  it('getUser returns the parsed profile', async () => {
    mockedApiFetch.mockResolvedValue({ ok: true, json: async () => ({ email: 'a@b.com', emailVerified: true }) })
    const user = await getUser()
    expect(user.email).toBe('a@b.com')
  })

  it('updateUser PATCHes the partial profile', async () => {
    mockedApiFetch.mockResolvedValue({ ok: true, json: async () => ({ email: 'a@b.com', emailVerified: true }) })
    await updateUser({ name: 'Sukrit' })
    expect(mockedApiFetch).toHaveBeenCalledWith('/api/user', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sukrit' }),
    })
  })
})

describe('changeEmail', () => {
  it('surfaces a friendly message on 409 instead of the generic status text', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 409 })
    await expect(changeEmail('taken@b.com')).rejects.toThrow('That email is already in use.')
  })

  it('throws the generic status message for other failures', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 500 })
    await expect(changeEmail('a@b.com')).rejects.toThrow('Failed to change email: 500')
  })

  it('returns the parsed body on success', async () => {
    mockedApiFetch.mockResolvedValue({ ok: true, json: async () => ({ email: 'a@b.com', emailVerified: false }) })
    const result = await changeEmail('a@b.com')
    expect(result).toEqual({ email: 'a@b.com', emailVerified: false })
  })
})
