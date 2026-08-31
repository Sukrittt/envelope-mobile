import { useMutation } from '@tanstack/react-query'
import { scanBill } from '@/src/api/scan'

/** No cache invalidation — a scan reads nothing and writes nothing. */
export function useScanBill() {
  return useMutation({ mutationFn: scanBill })
}
