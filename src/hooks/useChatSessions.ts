import { useQuery } from '@tanstack/react-query'
import { listChatSessions } from '@/src/api/ai'

const key = ['chatSessions'] as const

/** Only fetches while `enabled` — the history list is opened on demand, not on every chat mount. */
export function useChatSessions(enabled: boolean) {
  return useQuery({ queryKey: key, queryFn: listChatSessions, enabled, staleTime: 10_000 })
}
