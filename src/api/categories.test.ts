jest.mock('./client', () => ({
  apiFetch: jest.fn(),
  apiErrorMessage: jest.requireActual('./client').apiErrorMessage,
}))

import { apiFetch } from './client'
import { getCategories, addCategory, updateCategory, deleteCategory, moveCategory } from './categories'

const mockedApiFetch = apiFetch as jest.Mock

beforeEach(() => {
  mockedApiFetch.mockReset()
})

describe('getCategories', () => {
  it('returns the parsed JSON body', async () => {
    mockedApiFetch.mockResolvedValue({ ok: true, json: async () => [{ name: 'Rent', group: 'Home' }] })
    const rows = await getCategories()
    expect(rows).toEqual([{ name: 'Rent', group: 'Home' }])
  })
})

describe('addCategory', () => {
  it('uses apiErrorMessage for the failure text (real {error} body)', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'Name already exists' }) })
    await expect(addCategory('Rent')).rejects.toThrow('Name already exists')
  })

  it('falls back to the generic apiErrorMessage text on a non-JSON body', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error('not json') } })
    await expect(addCategory('Rent')).rejects.toThrow('Failed to add category: 500')
  })

  it('sends the group default when omitted', async () => {
    mockedApiFetch.mockResolvedValue({ ok: true })
    await addCategory('Rent')
    expect(mockedApiFetch).toHaveBeenCalledWith('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Rent', group: '' }),
    })
  })
})

describe('updateCategory / deleteCategory / moveCategory', () => {
  it('updateCategory PUTs the name plus updates', async () => {
    mockedApiFetch.mockResolvedValue({ ok: true })
    await updateCategory('Rent', { newName: 'Housing' })
    expect(mockedApiFetch).toHaveBeenCalledWith('/api/categories', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Rent', newName: 'Housing' }),
    })
  })

  it('deleteCategory throws with status on failure', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 404 })
    await expect(deleteCategory('Rent')).rejects.toThrow('Failed to delete category: 404')
  })

  it('moveCategory POSTs to the move endpoint', async () => {
    mockedApiFetch.mockResolvedValue({ ok: true })
    await moveCategory('Rent', 2)
    expect(mockedApiFetch).toHaveBeenCalledWith('/api/categories/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Rent', toIndex: 2 }),
    })
  })
})
