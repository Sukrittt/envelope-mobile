import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addExpense, deleteExpense, getExpenses, updateExpense } from '@/src/api/expenses'

const key = ['expenses'] as const

export function useExpenses() {
  return useQuery({ queryKey: key, queryFn: getExpenses, staleTime: 30_000 })
}

export function useAddExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (row: Parameters<typeof addExpense>[0]) => addExpense(row),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })
}

export function useUpdateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: {
      timestamp: string
      item: string
      amountInr: number
      updates: Parameters<typeof updateExpense>[3]
    }) => updateExpense(params.timestamp, params.item, params.amountInr, params.updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { timestamp: string; item: string; amountInr: number }) =>
      deleteExpense(params.timestamp, params.item, params.amountInr),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })
}
