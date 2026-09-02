import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addBudget, deleteBudget, getBudgets, transferBudget, updateBudget } from '@/src/api/budgets'
import type { BudgetRow } from '@/src/types'

export const budgetsKey = ['budgets'] as const
const key = budgetsKey
// Money Brain's brief is computed from budgets too, but keyed separately —
// an edit here must bust it or it shows stale numbers for up to its 15min staleTime.
const briefKey = ['ai-brief'] as const

export function useBudgets() {
  return useQuery({ queryKey: key, queryFn: getBudgets, staleTime: 30_000 })
}

export function useAddBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (row: Omit<BudgetRow, 'rolled_over'> & { rolled_over?: string }) => addBudget(row),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: briefKey })
    },
  })
}

export function useUpdateBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { month: string; category: string; updates: Partial<BudgetRow & { newCategory?: string }> }) =>
      updateBudget(params.month, params.category, params.updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: briefKey })
    },
  })
}

export function useTransferBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { month: string; to: string; sources: { category: string; amount: number }[] }) =>
      transferBudget(params.month, params.to, params.sources),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: briefKey })
    },
  })
}

export function useDeleteBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { month: string; category: string }) => deleteBudget(params.month, params.category),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: briefKey })
    },
  })
}
