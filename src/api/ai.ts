import { fetch as expoFetch } from 'expo/fetch'
import { apiFetch, BASE_URL } from './client'
import { getValidToken } from './accessMode'

export interface BriefCard {
  icon: string
  title: string
  subtitle: string
  valueLabel: string
  amount: number
  tone: 'mint' | 'violet' | 'coral' | 'warn'
}

export interface Brief {
  narrative: string
  cards: BriefCard[]
  questions: string[]
  meta: {
    txnCountThisMonth: number
    totalSpent: number
    totalAssigned: number
    daysLeft: number
  }
}

export interface ChatMessage {
  role: 'user' | 'model'
  text: string
}

export async function fetchBrief(): Promise<Brief> {
  const resp = await apiFetch('/api/ai/brief')
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}))
    throw new Error(detail.error ?? `Failed to load brief: ${resp.status}`)
  }
  return resp.json()
}

// Second auth-header site: this path bypasses apiFetch because it needs
// expo/fetch for streaming, so it must refresh the token itself.
async function authHeader(): Promise<Record<string, string>> {
  const token = await getValidToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * Streams /api/ai/chat via expo/fetch (RN's global fetch can't read streaming
 * bodies under Hermes). Buffers decoded text and splits on the SSE frame
 * delimiter ("\n\n"), calling onDelta for each `data: {"delta":...}` frame.
 */
export async function streamChat(
  messages: ChatMessage[],
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const resp = await expoFetch(`${BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ messages }),
    signal,
  })

  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}))
    throw new Error(detail.error ?? `Failed to chat: ${resp.status}`)
  }
  if (!resp.body) throw new Error('Failed to chat: empty response body')

  const decoder = new TextDecoder()
  let buffer = ''

  for await (const chunk of resp.body) {
    buffer += decoder.decode(chunk, { stream: true })
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''
    for (const frame of frames) {
      const line = frame.split('\n').find((l) => l.startsWith('data: '))
      if (!line) continue
      const payload = line.slice('data: '.length)
      if (payload === '[DONE]') return
      const parsed = JSON.parse(payload)
      if (parsed.error) throw new Error(parsed.error)
      if (typeof parsed.delta === 'string') onDelta(parsed.delta)
    }
  }
}
