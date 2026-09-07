import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { addHolding } from '@/src/api/holdings'
import { useAddHolding } from './useHoldings'

jest.mock('@/src/api/holdings', () => ({
  getHoldings: jest.fn(),
  addHolding: jest.fn(),
  updateHolding: jest.fn(),
  deleteHolding: jest.fn(),
  performHoldingAction: jest.fn(),
}))

function wrapper(queryClient: QueryClient) {
  function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return QueryWrapper
}

/** A promise whose resolution this test controls, to hold an async call open on demand. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

beforeEach(() => {
  jest.clearAllMocks()
})

// investments.tsx stays mounted under the add-holding modal (presentation:
// 'modal'), so its useHoldings() observer is still "active" when
// useAddHolding()'s onSuccess invalidates it. A caller that closes the modal
// (or plays a success animation) once mutate() resolves needs that resolve to
// happen only after the invalidated refetch has actually landed — otherwise
// the modal can close while the list underneath is still showing stale data,
// only catching up on the next manual pull-to-refresh. That requires the
// hook to actually await invalidateQueries, not fire it and move on.
it('useAddHolding does not report success until invalidateQueries settles', async () => {
  ;(addHolding as jest.Mock).mockResolvedValue(undefined)

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const gate = deferred<void>()
  const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries').mockReturnValue(gate.promise)

  const { result } = renderHook(() => useAddHolding(), { wrapper: wrapper(queryClient) })

  act(() => {
    result.current.mutate({ name: 'Stocks', type: 'Equity', value: '5000' })
  })

  await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['holdings'] }))
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['holding-events'] })
  // The gate is still open — a fire-and-forget invalidate would already have
  // flipped this to true.
  expect(result.current.isSuccess).toBe(false)

  act(() => {
    gate.resolve()
  })

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
})
