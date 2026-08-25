import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react-native'
import { getUser, updateUser } from '@/src/api/account'
import { useUser, useUpdateUser, userKey } from './useUser'

jest.mock('@/src/api/account', () => ({
  getUser: jest.fn(),
  updateUser: jest.fn(),
  getSessions: jest.fn(),
  getIdentityProviders: jest.fn(),
}))

function wrapper(queryClient: QueryClient) {
  function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return QueryWrapper
}

it('useUser resolves the profile from the API', async () => {
  ;(getUser as jest.Mock).mockResolvedValue({ email: 'a@b.com', emailVerified: true })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const { result } = renderHook(() => useUser(), { wrapper: wrapper(queryClient) })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data?.email).toBe('a@b.com')
})

it('useUpdateUser invalidates the user query on success', async () => {
  ;(updateUser as jest.Mock).mockResolvedValue({ email: 'a@b.com', emailVerified: true })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
  const { result } = renderHook(() => useUpdateUser(), { wrapper: wrapper(queryClient) })

  result.current.mutate({ name: 'Sukrit' })

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: userKey })
})
