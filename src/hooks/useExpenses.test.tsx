import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react-native'
import { getExpenses, addExpense } from '@/src/api/expenses'
import { useExpenses, useAddExpense } from './useExpenses'

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
