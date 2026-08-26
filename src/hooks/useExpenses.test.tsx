import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react-native'
import { getExpenses, addExpense, updateExpense } from '@/src/api/expenses'
import { useExpenses, useAddExpense, useUpdateExpense } from './useExpenses'

jest.mock('@/src/api/expenses', () => ({
  getExpenses: jest.fn(),
  addExpense: jest.fn(),
  updateExpense: jest.fn(),
  deleteExpense: jest.fn(),
}))

function wrapper(queryClient: QueryClient) {
  function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return QueryWrapper
}

it('useExpenses resolves the query with the API result', async () => {
  ;(getExpenses as jest.Mock).mockResolvedValue([{ item: 'Coffee' }])
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const { result } = renderHook(() => useExpenses(), { wrapper: wrapper(queryClient) })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data).toEqual([{ item: 'Coffee' }])
})

it('useAddExpense invalidates both the expenses and ai-brief queries on success', async () => {
  ;(addExpense as jest.Mock).mockResolvedValue(undefined)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
  const { result } = renderHook(() => useAddExpense(), { wrapper: wrapper(queryClient) })

  result.current.mutate({ item: 'Coffee', amount_inr: '150', category: 'Food' })

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['expenses'] })
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ai-brief'] })
})

// An edit can flip payment_method or move month, which rebalances the
// Credit Card envelope server-side — the budgets cache must bust too or
// Envelopes shows a stale balance until its 30s staleTime lapses.
it('useUpdateExpense also invalidates the budgets query on success', async () => {
  ;(updateExpense as jest.Mock).mockResolvedValue(undefined)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
  const { result } = renderHook(() => useUpdateExpense(), { wrapper: wrapper(queryClient) })

  result.current.mutate({
    timestamp: '2026-01-01T10:00:00',
    item: 'Taxi',
    amountInr: 400,
    updates: { new_payment_method: 'credit_card' },
  })

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['expenses'] })
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ai-brief'] })
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['budgets'] })
})
