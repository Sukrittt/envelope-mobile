import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react-native'
import { addCategory, getCategories, moveCategory } from '@/src/api/categories'
import { writeCategoryCache } from '@/src/lib/categoryCache'
import type { CategoryRow } from '@/src/types'
import { useAddCategory, useCategories, useMoveCategory } from './useCategories'

jest.mock('@/src/api/categories', () => ({
  getCategories: jest.fn(),
  addCategory: jest.fn(),
  updateCategory: jest.fn(),
  deleteCategory: jest.fn(),
  moveCategory: jest.fn(),
}))

jest.mock('@/src/lib/categoryCache', () => ({
  readCategoryCache: jest.fn(),
  writeCategoryCache: jest.fn(),
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

describe('category cache write-through (offline sync §2)', () => {
  beforeEach(() => jest.clearAllMocks())

  it('a successful fetch writes the cache', async () => {
    ;(getCategories as jest.Mock).mockResolvedValue(rows)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useCategories(), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(writeCategoryCache).toHaveBeenCalledWith(rows)
  })

  it('adding a category rewrites the cache', async () => {
    ;(getCategories as jest.Mock).mockResolvedValue(rows)
    ;(addCategory as jest.Mock).mockResolvedValue(undefined)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const categories = renderHook(() => useCategories(), { wrapper: wrapper(queryClient) })
    await waitFor(() => expect(categories.result.current.isSuccess).toBe(true))
    ;(writeCategoryCache as jest.Mock).mockClear()

    const add = renderHook(() => useAddCategory(), { wrapper: wrapper(queryClient) })
    add.result.current.mutate({ name: 'Transport' })

    await waitFor(() => expect(add.result.current.isSuccess).toBe(true))
    // invalidateQueries refetches the active ['categories'] query through the
    // same write-through queryFn, so the mutation itself needs no separate
    // cache-write call.
    await waitFor(() => expect(writeCategoryCache).toHaveBeenCalledWith(rows))
  })

  it('a boot with no network renders the cached list', async () => {
    ;(getCategories as jest.Mock).mockRejectedValue(new TypeError('Network request failed'))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    // Mirrors app/_layout.tsx hydrating ['categories'] from disk at boot,
    // before any component mounts.
    queryClient.setQueryData(key, rows)
    const { result } = renderHook(() => useCategories(), { wrapper: wrapper(queryClient) })

    expect(result.current.data).toEqual(rows)
    expect(result.current.isSuccess).toBe(true)
  })
})
