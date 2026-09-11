import { useMutation, useQuery } from '@tanstack/react-query'
import { getBillScan, getBillScans, saveBillScan } from '@/src/api/bills'

const key = ['bill-scans'] as const

/** No cache invalidation on save — the save happens right after confirm, before this list is ever mounted. */
export function useSaveBillScan() {
  return useMutation({ mutationFn: saveBillScan })
}

export function useBillScans() {
  return useQuery({ queryKey: key, queryFn: getBillScans, staleTime: 30_000 })
}

export function useBillScan(id: string | undefined) {
  return useQuery({
    queryKey: [...key, id],
    queryFn: () => getBillScan(id as string),
    enabled: !!id,
  })
}
