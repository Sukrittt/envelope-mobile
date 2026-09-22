import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react-native'
import {
  dismissRecurringSuggestion,
  loadRecurringSuggestions,
  scanRecurringSuggestions,
} from '@/src/api/recurringSuggestions'
import type { RecurringScan } from '@/src/types/recurringSuggestions'
import {
  recurringSuggestionsKey,
  useAcceptRecurringSuggestion,
  useDismissRecurringSuggestion,
  useRecurringSuggestions,
  useScanRecurringSuggestions,
} from './useRecurringSuggestions'

jest.mock('@/src/api/recurringSuggestions', () => ({
  loadRecurringSuggestions: jest.fn(),
  scanRecurringSuggestions: jest.fn(),
  dismissRecurringSuggestion: jest.fn(),
}))

function wrapper(queryClient: QueryClient) {
  function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return QueryWrapper
}

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } })
}

function scan(suggestions: RecurringScan['suggestions']): RecurringScan {
  return { suggestions, scannedAt: '2026-09-22T00:00:00.000Z', windowStart: '2026-03-22', windowEnd: '2026-09-22', remaining: 0 }
}

const rentSuggestion = {
  id: 's1',
  kind: 'other_recurring' as const,
  dates: ['2026-08-04', '2026-09-03'],
  occurrences: 2,
  variableAmount: false,
  input: { item: 'Rent', amount_inr: '9500', category: 'Housing', frequency: 'monthly', start_date: '2026-10-01' },
}

it('useRecurringSuggestions resolves the query with the API result for the given months', async () => {
  ;(loadRecurringSuggestions as jest.Mock).mockResolvedValue(scan([rentSuggestion]))
  const queryClient = client()
  const { result } = renderHook(() => useRecurringSuggestions(6), { wrapper: wrapper(queryClient) })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(loadRecurringSuggestions).toHaveBeenCalledWith(6)
  expect(result.current.data?.suggestions).toEqual([rentSuggestion])
})

it('useScanRecurringSuggestions writes the result into the cache for the scanned months', async () => {
  ;(scanRecurringSuggestions as jest.Mock).mockResolvedValue(scan([rentSuggestion]))
  const queryClient = client()
  const { result } = renderHook(() => useScanRecurringSuggestions(), { wrapper: wrapper(queryClient) })

  result.current.mutate(3)

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(queryClient.getQueryData([...recurringSuggestionsKey, 3])).toEqual(scan([rentSuggestion]))
})

it('useDismissRecurringSuggestion drops the dismissed suggestion from every cached scan', async () => {
  ;(dismissRecurringSuggestion as jest.Mock).mockResolvedValue(undefined)
  const queryClient = client()
  queryClient.setQueryData([...recurringSuggestionsKey, 6], scan([rentSuggestion]))

  const { result } = renderHook(() => useDismissRecurringSuggestion(), { wrapper: wrapper(queryClient) })
  result.current.mutate('s1')

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(queryClient.getQueryData<RecurringScan>([...recurringSuggestionsKey, 6])?.suggestions).toEqual([])
})

it('useAcceptRecurringSuggestion drops the accepted suggestion from every cached scan', () => {
  const queryClient = client()
  queryClient.setQueryData([...recurringSuggestionsKey, 6], scan([rentSuggestion]))

  const { result } = renderHook(() => useAcceptRecurringSuggestion(), { wrapper: wrapper(queryClient) })
  result.current('s1')

  expect(queryClient.getQueryData<RecurringScan>([...recurringSuggestionsKey, 6])?.suggestions).toEqual([])
})
