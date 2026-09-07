import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react-native'
import {
  addRecurringExpense,
  deleteRecurringExpense,
  getRecurringExpenses,
  pauseRecurringExpense,
  resumeRecurringExpense,
  updateRecurringExpense,
} from '@/src/api/recurringExpenses'
import {
  useAddRecurringExpense,
  useDeleteRecurringExpense,
  usePauseRecurringExpense,
  useRecurringExpenses,
  useResumeRecurringExpense,
  useUpdateRecurringExpense,
} from './useRecurringExpenses'

jest.mock('@/src/api/recurringExpenses', () => ({
  getRecurringExpenses: jest.fn(),
  addRecurringExpense: jest.fn(),
  updateRecurringExpense: jest.fn(),
  pauseRecurringExpense: jest.fn(),
  resumeRecurringExpense: jest.fn(),
  deleteRecurringExpense: jest.fn(),
}))

function wrapper(queryClient: QueryClient) {
  function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return QueryWrapper
}

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

it('useRecurringExpenses resolves the query with the API result', async () => {
  ;(getRecurringExpenses as jest.Mock).mockResolvedValue([{ id: 'r1', item: 'Rent' }])
  const queryClient = client()
  const { result } = renderHook(() => useRecurringExpenses(), { wrapper: wrapper(queryClient) })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data).toEqual([{ id: 'r1', item: 'Rent' }])
})

// Same contract as useSubscriptions: recurring expenses feed Money Brain's
// brief, which is keyed separately, so every mutation must bust both.
describe('every mutation invalidates both recurring-expenses and ai-brief', () => {
  const cases: [string, jest.Mock, () => { mutate: (args: never) => void }, unknown][] = [
    [
      'useAddRecurringExpense',
      addRecurringExpense as jest.Mock,
      useAddRecurringExpense,
      { item: 'Rent', amount_inr: '25000', category: 'Housing', frequency: 'monthly', start_date: '2026-09-15' },
    ],
    [
      'useUpdateRecurringExpense',
      updateRecurringExpense as jest.Mock,
      useUpdateRecurringExpense,
      { id: 'r1', updates: { amount_inr: '30000' } },
    ],
    ['usePauseRecurringExpense', pauseRecurringExpense as jest.Mock, usePauseRecurringExpense, 'r1'],
    ['useResumeRecurringExpense', resumeRecurringExpense as jest.Mock, useResumeRecurringExpense, 'r1'],
    ['useDeleteRecurringExpense', deleteRecurringExpense as jest.Mock, useDeleteRecurringExpense, 'r1'],
  ]

  it.each(cases)('%s', async (_name, apiMock, useHook, args) => {
    apiMock.mockResolvedValue(undefined)
    const queryClient = client()
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useHook(), { wrapper: wrapper(queryClient) })

    result.current.mutate(args as never)

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['recurring-expenses'] }))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ai-brief'] })
  })
})
