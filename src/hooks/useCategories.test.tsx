import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react-native'
import { moveCategory } from '@/src/api/categories'
import type { CategoryRow } from '@/src/types'
import { useMoveCategory } from './useCategories'

jest.mock('@/src/api/categories', () => ({
  getCategories: jest.fn(),
  addCategory: jest.fn(),
  updateCategory: jest.fn(),
  deleteCategory: jest.fn(),
  moveCategory: jest.fn(),
}))

const key = ['categories'] as const

function wrapper(queryClient: QueryClient) {
  function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return QueryWrapper
}

const rows: CategoryRow[] = [
  { name: 'Rent', group: 'Home' },
  { name: 'Water', group: 'Home' },
  { name: 'Groceries', group: 'Food' },
]

it('optimistically reorders within the group on mutate', async () => {
  // Held pending (not resolved yet) so the assertion below observes the
  // optimistic write, not the post-settle state — resolved at the end so
  // the mutation actually completes and doesn't leak a pending handle.
  let resolveMove: () => void = () => {}
  ;(moveCategory as jest.Mock).mockImplementation(
    () => new Promise<void>((resolve) => { resolveMove = resolve }),
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(key, rows)
  const { result } = renderHook(() => useMoveCategory(), { wrapper: wrapper(queryClient) })

  result.current.mutate({ name: 'Water', toIndex: 0 })

  await waitFor(() => {
    const data = queryClient.getQueryData<CategoryRow[]>(key)
    expect(data?.map((c) => c.name)).toEqual(['Water', 'Rent', 'Groceries'])
  })

  resolveMove()
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
})

it('rolls back to the previous list when the mutation errors', async () => {
  ;(moveCategory as jest.Mock).mockRejectedValue(new Error('network error'))
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(key, rows)
  const { result } = renderHook(() => useMoveCategory(), { wrapper: wrapper(queryClient) })

  result.current.mutate({ name: 'Water', toIndex: 0 })

  await waitFor(() => expect(result.current.isError).toBe(true))
  const data = queryClient.getQueryData<CategoryRow[]>(key)
  expect(data?.map((c) => c.name)).toEqual(['Rent', 'Water', 'Groceries'])
})
