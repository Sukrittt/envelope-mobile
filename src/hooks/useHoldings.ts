import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addHolding, deleteHolding, getHoldings, performHoldingAction, updateHolding } from '@/src/api/holdings'

const key = ['holdings'] as const
const eventsKey = ['holding-events'] as const

export function useHoldings() {
  return useQuery({ queryKey: key, queryFn: getHoldings, staleTime: 30_000 })
}

export function useAddHolding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (row: Parameters<typeof addHolding>[0]) => addHolding(row),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: eventsKey })
    },
  })
}

export function useUpdateHolding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { name: string; updates: Parameters<typeof updateHolding>[1] }) =>
      updateHolding(params.name, params.updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: eventsKey })
    },
  })
}

export function useDeleteHolding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => deleteHolding(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: eventsKey })
    },
  })
}

export function usePerformHoldingAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: Parameters<typeof performHoldingAction>[0]) => performHoldingAction(params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: eventsKey })
    },
  })
}
