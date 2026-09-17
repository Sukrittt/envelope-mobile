import { apiFetch } from './client'

export interface SystemStatus {
  aiDisabled: boolean
  maintenance: { on: boolean; message: string }
  appUpdate?: {
    android?: { latestVersion: string; storeUrl: string }
  }
}

/** Public app-wide status. Failures are handled by callers as "show nothing". */
export async function getSystemStatus(): Promise<SystemStatus> {
  const resp = await apiFetch('/api/system/status')
  if (!resp.ok) throw new Error(`Failed to load system status: ${resp.status}`)
  return resp.json()
}
