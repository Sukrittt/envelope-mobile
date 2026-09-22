import { apiFetch } from './client'
import { updateHolding } from './holdings'

jest.mock('./client', () => ({ apiFetch: jest.fn() }))

const mockedApiFetch = apiFetch as jest.Mock

beforeEach(() => mockedApiFetch.mockReset())

describe('holding write versions', () => {
  it('sends the loaded version with updates', async () => {
    mockedApiFetch.mockResolvedValue({ ok: true })

    await updateHolding('Stocks', { recurring_amount: '150' }, 7)

    expect(JSON.parse(mockedApiFetch.mock.calls[0][1].body)).toEqual({
      name: 'Stocks',
      recurring_amount: '150',
      version: 7,
    })
  })

  it('preserves the latest holding on a conflict for review', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: 'Holding changed elsewhere',
        current: { name: 'Stocks', version: 8, recurring_amount: '200' },
      }),
    })

    await expect(updateHolding('Stocks', { recurring_amount: '150' }, 7)).rejects.toMatchObject({
      status: 409,
      current: { name: 'Stocks', version: 8, recurring_amount: '200' },
    })
  })
})
