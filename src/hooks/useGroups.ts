import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addGroup, deleteGroup, getGroups, updateGroup } from '@/src/api/groups'

const key = ['groups'] as const

export function useGroups() {
  return useQuery({ queryKey: key, queryFn: getGroups, staleTime: 30_000 })
}

export function useAddGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => addGroup(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })
}

export function useUpdateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { name: string; newName: string }) => updateGroup(params.name, params.newName),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })
}

export function useDeleteGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => deleteGroup(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })
}
