import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addSubscription,
  cancelSubscription,
  deleteSubscription,
  getSubscriptions,
  reactivateSubscription,
  updateSubscription,
} from '@/src/api/subscriptions'

const key = ['subscriptions'] as const

export function useSubscriptions() {
  return useQuery({ queryKey: key, queryFn: getSubscriptions, staleTime: 30_000 })
}

export function useAddSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (row: Parameters<typeof addSubscription>[0]) => addSubscription(row),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })
}

export function useUpdateSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { service: string; updates: Parameters<typeof updateSubscription>[1] }) =>
      updateSubscription(params.service, params.updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })
}

export function useCancelSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (service: string) => cancelSubscription(service),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })
}

export function useReactivateSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (service: string) => reactivateSubscription(service),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })
}

export function useDeleteSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (service: string) => deleteSubscription(service),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })
}
