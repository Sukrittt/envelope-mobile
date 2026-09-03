import { getValidToken } from '@/src/api/accessMode'
import { HttpError } from '@/src/api/client'
import { postExpensePayload } from '@/src/api/expenses'
import * as pending from '@/src/lib/pendingExpenses'
import { flush } from './flush'
import type { ExpensePayload } from '@/src/api/expenses'

jest.mock('@/src/api/accessMode', () => ({
  getValidToken: jest.fn(),
}))

jest.mock('@/src/api/client', () => ({
  HttpError: class HttpError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

jest.mock('@/src/api/expenses', () => ({
  postExpensePayload: jest.fn(),
}))

jest.mock('@/src/lib/pendingExpenses', () => ({
  list: jest.fn(),
  remove: jest.fn(),
  bumpAttempts: jest.fn(),
}))

function entry(clientId: string) {
  return {
    attempts: 0,
    payload: {
      client_id: clientId,
      item: 'Coffee',
      amount_inr: '150',
      category: 'Food',
      date: '2026-01-01',
      timestamp: '2026-01-01T10:00:00+05:30',
    } as ExpensePayload,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getValidToken as jest.Mock).mockResolvedValue('token')
})

it('a null token aborts without draining', async () => {
  ;(getValidToken as jest.Mock).mockResolvedValue(null)
  ;(pending.list as jest.Mock).mockResolvedValue([entry('c1')])

  await flush()

  expect(postExpensePayload).not.toHaveBeenCalled()
})

it('a successful drain empties the queue', async () => {
  ;(pending.list as jest.Mock).mockResolvedValue([entry('c1'), entry('c2')])
  ;(postExpensePayload as jest.Mock).mockResolvedValue({ id: 'row-1', timestamp: 'ts' })

  await flush()

  expect(postExpensePayload).toHaveBeenCalledTimes(2)
  expect(pending.remove).toHaveBeenCalledWith('c1')
  expect(pending.remove).toHaveBeenCalledWith('c2')
})

it('a transport failure leaves the queue intact and stops the rest of the batch', async () => {
  ;(pending.list as jest.Mock).mockResolvedValue([entry('c1'), entry('c2')])
  ;(postExpensePayload as jest.Mock).mockRejectedValue(new TypeError('Network request failed'))

  await flush()

  expect(postExpensePayload).toHaveBeenCalledTimes(1)
  expect(pending.remove).not.toHaveBeenCalled()
  expect(pending.bumpAttempts).not.toHaveBeenCalled()
})

it('a 4xx bumps attempts and moves on to the rest of the queue', async () => {
  ;(pending.list as jest.Mock).mockResolvedValue([entry('c1'), entry('c2')])
  ;(postExpensePayload as jest.Mock)
    .mockRejectedValueOnce(new HttpError(400, 'bad request'))
    .mockResolvedValueOnce({ id: 'row-2', timestamp: 'ts' })

  await flush()

  expect(pending.bumpAttempts).toHaveBeenCalledWith('c1', 3)
  expect(pending.remove).toHaveBeenCalledWith('c2')
})

it('two concurrent flush() calls make only one round of requests', async () => {
  let resolveList: (v: unknown) => void = () => {}
  ;(pending.list as jest.Mock).mockReturnValue(new Promise((resolve) => { resolveList = resolve }))
  ;(postExpensePayload as jest.Mock).mockResolvedValue({ id: 'row-1', timestamp: 'ts' })

  const first = flush()
  const second = flush()
  resolveList([entry('c1')])
  await Promise.all([first, second])

  expect(pending.list).toHaveBeenCalledTimes(1)
  expect(postExpensePayload).toHaveBeenCalledTimes(1)
})
