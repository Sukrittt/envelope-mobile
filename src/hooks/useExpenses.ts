import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addExpense, deleteExpense, getExpenses, updateExpense } from '@/src/api/expenses'
import { budgetsKey } from '@/src/hooks/useBudgets'

const key = ['expenses'] as const
// Money Brain's brief is computed from expenses too, but keyed separately —
// an edit here must bust it or it shows stale numbers for up to its 15min staleTime.
const briefKey = ['ai-brief'] as const

export function useExpenses() {
  return useQuery({ queryKey: key, queryFn: getExpenses, staleTime: 30_000 })
}

export function useAddExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (row: Parameters<typeof addExpense>[0]) => addExpense(row),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: briefKey })
      // A credit-card expense add/edit/delete also rebalances the Credit
      // Card envelope server-side — bust budgets too or Envelopes shows a
      // stale balance for up to its 30s staleTime.
      qc.invalidateQueries({ queryKey: budgetsKey })
    },
  })
}

export function useUpdateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: {
      id?: string
      timestamp: string
      item: string
      amountInr: number
      updates: Parameters<typeof updateExpense>[4]
    }) => updateExpense(params.id, params.timestamp, params.item, params.amountInr, params.updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: briefKey })
      // See useAddExpense — this can also rebalance the CC envelope.
      qc.invalidateQueries({ queryKey: budgetsKey })
    },
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { id?: string; timestamp: string; item: string; amountInr: number }) =>
      deleteExpense(params.id, params.timestamp, params.item, params.amountInr),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: briefKey })
      // See useAddExpense — this can also rebalance the CC envelope.
      qc.invalidateQueries({ queryKey: budgetsKey })
    },
  })
}
