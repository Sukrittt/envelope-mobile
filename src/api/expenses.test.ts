jest.mock('./client', () => ({
  apiFetch: jest.fn(),
}))

import { apiFetch } from './client'
import { getExpenses, addExpense, updateExpense, deleteExpense } from './expenses'

const mockedApiFetch = apiFetch as jest.Mock

beforeEach(() => {
  mockedApiFetch.mockReset()
})

describe('getExpenses', () => {
  it('unwraps rows from the CSV response', async () => {
    mockedApiFetch.mockResolvedValue({ ok: true, json: async () => ({ headers: [], rows: [{ item: 'Coffee' }] }) })
    const rows = await getExpenses()
    expect(rows).toEqual([{ item: 'Coffee' }])
    expect(mockedApiFetch).toHaveBeenCalledWith('/api/expenses')
  })

  it('throws with the status on a failed response', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 500 })
    await expect(getExpenses()).rejects.toThrow('Failed to load expenses: 500')
  })
})

describe('addExpense', () => {
  it('POSTs the row as JSON', async () => {
    mockedApiFetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    await addExpense({ item: 'Coffee', amount_inr: '150', category: 'Food' })
    expect(mockedApiFetch).toHaveBeenCalledWith('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: 'Coffee', amount_inr: '150', category: 'Food' }),
    })
  })
})

describe('updateExpense', () => {
  it('reads {error} from the response body on failure', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'Amount required' }) })
    await expect(updateExpense('id1', 'ts', 'Coffee', 150, {})).rejects.toThrow('Amount required')
  })

  it('falls back to a generic message when the body has no error field', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({}) })
    await expect(updateExpense('id1', 'ts', 'Coffee', 150, {})).rejects.toThrow('Failed to update expense: 400')
  })
})

describe('deleteExpense', () => {
  it('DELETEs with the identifying fields', async () => {
    mockedApiFetch.mockResolvedValue({ ok: true })
    await deleteExpense('id1', 'ts', 'Coffee', 150)
    expect(mockedApiFetch).toHaveBeenCalledWith('/api/expenses', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'id1', timestamp: 'ts', item: 'Coffee', amount_inr: '150' }),
    })
  })
})
