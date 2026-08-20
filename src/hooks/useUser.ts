import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getUser, updateUser, type UserProfile } from '@/src/api/account'

const key = ['user'] as const

export function useUser() {
  return useQuery({ queryKey: key, queryFn: getUser, staleTime: 30_000 })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<UserProfile>) => updateUser(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })
}
