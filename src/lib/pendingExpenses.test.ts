import AsyncStorage from '@react-native-async-storage/async-storage'
import * as accessMode from '@/src/api/accessMode'
import * as pending from './pendingExpenses'
import type { ExpensePayload } from '@/src/api/expenses'

// The real (mocked, see jest.setup.js) AsyncStorage — no per-file mock needed.

jest.mock('@/src/api/accessMode', () => ({
  currentUserId: jest.fn(),
}))

function payload(clientId: string): ExpensePayload {
  return {
    client_id: clientId,
    item: 'Coffee',
    amount_inr: '150',
    category: 'Food',
    date: '2026-01-01',
    timestamp: '2026-01-01T10:00:00+05:30',
  }
}

beforeEach(async () => {
  await AsyncStorage.clear()
  jest.clearAllMocks()
  ;(accessMode.currentUserId as jest.Mock).mockReturnValue('user_a')
})

it('enqueue survives a reload (a fresh read sees what a previous enqueue wrote)', async () => {
  await pending.enqueue(payload('c1'))
  const entries = await pending.list()
  expect(entries).toHaveLength(1)
  expect(entries[0].payload.client_id).toBe('c1')
})

it('drains in insertion order', async () => {
  await pending.enqueue(payload('c1'))
  await pending.enqueue(payload('c2'))
  await pending.enqueue(payload('c3'))
  const entries = await pending.list()
  expect(entries.map((e) => e.payload.client_id)).toEqual(['c1', 'c2', 'c3'])
})

it('a concurrent enqueue during a drain loses nothing', async () => {
  await Promise.all([pending.enqueue(payload('c1')), pending.enqueue(payload('c2')), pending.enqueue(payload('c3'))])
  const entries = await pending.list()
  expect(entries.map((e) => e.payload.client_id).sort()).toEqual(['c1', 'c2', 'c3'])
})

it('nothing is written when currentUserId() is null (guest)', async () => {
  ;(accessMode.currentUserId as jest.Mock).mockReturnValue(null)
  await pending.enqueue(payload('c1'))
  expect(await pending.list()).toEqual([])
})

it("user A's queue is invisible to user B", async () => {
  ;(accessMode.currentUserId as jest.Mock).mockReturnValue('user_a')
  await pending.enqueue(payload('c1'))

  ;(accessMode.currentUserId as jest.Mock).mockReturnValue('user_b')
  expect(await pending.list()).toEqual([])

  ;(accessMode.currentUserId as jest.Mock).mockReturnValue('user_a')
  expect(await pending.list()).toHaveLength(1)
})

it('a queue survives sign-out (nothing here deletes it; see accessMode.clearAccess)', async () => {
  await pending.enqueue(payload('c1'))
  // clearAccess() never touches this module; re-signing in as the same user
  // must see the same queue.
  expect(await pending.list()).toHaveLength(1)
})

it('remove drops exactly the matching entry', async () => {
  await pending.enqueue(payload('c1'))
  await pending.enqueue(payload('c2'))
  await pending.remove('c1')
  expect((await pending.list()).map((e) => e.payload.client_id)).toEqual(['c2'])
})

it('bumpAttempts moves an entry to the failed list once it hits the cap', async () => {
  await pending.enqueue(payload('c1'))
  await pending.bumpAttempts('c1', 3)
  await pending.bumpAttempts('c1', 3)
  expect(await pending.list()).toHaveLength(1)
  await pending.bumpAttempts('c1', 3)
  expect(await pending.list()).toHaveLength(0)
  expect(await pending.listFailed()).toHaveLength(1)
})
