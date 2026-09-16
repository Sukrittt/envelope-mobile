import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addGroup, deleteGroup, getGroups, moveGroup, updateGroup } from '@/src/api/groups'

const key = ['groups'] as const
const categoriesKey = ['categories'] as const
const moveKey = ['groups', 'move'] as const

export function useGroups() {
  return useQuery({ queryKey: key, queryFn: getGroups, staleTime: 30_000 })
}

export function useAddGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => addGroup(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: categoriesKey })
    },
  })
}

export function useUpdateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { name: string; newName: string }) => updateGroup(params.name, params.newName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: categoriesKey })
    },
  })
}

export function useDeleteGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => deleteGroup(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: categoriesKey })
    },
  })
}

export function useMoveGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: moveKey,
    // Keep API writes in gesture order, including across hook instances. Optimistic
    // onMutate still runs immediately for queued moves, so the next drag needn't wait.
    scope: { id: 'group-reorder' },
    mutationFn: (params: { name: string; toIndex: number }) => moveGroup(params.name, params.toIndex),
    onMutate: (params) => {
      qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<string[]>(key)
      if (previous) {
        const idx = previous.indexOf(params.name)
        if (idx !== -1) {
          const next = [...previous]
          next.splice(idx, 1)
          next.splice(params.toIndex, 0, params.name)
          qc.setQueryData<string[]>(key, next)
        }
      }
      return { previous }
    },
    onError: (_err, _params, context) => {
      if (context?.previous && qc.isMutating({ mutationKey: moveKey }) === 1) {
        qc.setQueryData(key, context.previous)
      }
    },
    onSettled: () => {
      // An intermediate refetch would overwrite later optimistic moves with an
      // older server order. Reconcile only once the queue has drained.
      if (qc.isMutating({ mutationKey: moveKey }) === 1) {
        return Promise.all([
          qc.invalidateQueries({ queryKey: key }),
          qc.invalidateQueries({ queryKey: categoriesKey }),
        ])
      }
    },
  })
}
