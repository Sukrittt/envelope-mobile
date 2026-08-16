import { apiFetch } from './client'

export async function registerPushToken(token: string, platform: 'ios' | 'android'): Promise<void> {
  const resp = await apiFetch('/api/notifications/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, platform }),
  })
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}))
    throw new Error(detail.error ?? `Failed to register push token: ${resp.status}`)
  }
}
