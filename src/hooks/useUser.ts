import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getUser, getIdentityProviders, getSessions, updateUser, type UserProfile } from '@/src/api/account'

const key = ['user'] as const
const sessionsKey = ['user', 'sessions'] as const
const identitiesKey = ['user', 'identities'] as const

export function useUser() {
  return useQuery({ queryKey: key, queryFn: getUser, staleTime: 30_000 })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<UserProfile>) => updateUser(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (err) => console.warn('[useUpdateUser] update failed:', err),
  })
}

export function useSessions() {
  return useQuery({ queryKey: sessionsKey, queryFn: getSessions, staleTime: 30_000 })
}

export function useIdentities() {
  return useQuery({ queryKey: identitiesKey, queryFn: getIdentityProviders, staleTime: 30_000 })
}
