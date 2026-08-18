import { useQuery } from '@tanstack/react-query'
import { getWrapped } from '@/src/api/wrapped'

const key = ['wrapped'] as const

export function useWrapped() {
  return useQuery({ queryKey: key, queryFn: getWrapped, staleTime: 15 * 60_000, retry: 1 })
}
