// User profile, notifications and data-management calls — all post-auth, so
// they ride apiFetch's automatic bearer-token attachment (unlike magicAuth.ts,
// which talks to the API before any session exists).
import { apiFetch } from './client'

export interface UserProfile {
  email: string
  name?: string | null
  provider?: string | null
  onboardedAt?: string | null
  notifyCadence?: 'off' | 'weekly' | 'daily'
}

export interface DataSummary {
  transactionCount: number
  envelopeCount: number
}

export async function getUser(): Promise<UserProfile> {
  const resp = await apiFetch('/api/user')
  if (!resp.ok) throw new Error(`Failed to load user: ${resp.status}`)
  return resp.json()
}

export async function updateUser(patch: Partial<UserProfile>): Promise<UserProfile> {
  const resp = await apiFetch('/api/user', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!resp.ok) throw new Error(`Failed to update user: ${resp.status}`)
  return resp.json()
}

export async function deleteAccount(): Promise<void> {
  const resp = await apiFetch('/api/user', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: true }),
  })
  if (!resp.ok) throw new Error(`Failed to delete account: ${resp.status}`)
}

export async function exportData(format: 'csv' | 'json'): Promise<string> {
  const resp = await apiFetch(`/api/data/export?format=${format}`)
  if (!resp.ok) throw new Error(`Failed to export data: ${resp.status}`)
  return resp.text()
}

export async function getDataSummary(): Promise<DataSummary> {
  const resp = await apiFetch('/api/data/summary')
  if (!resp.ok) throw new Error(`Failed to load data summary: ${resp.status}`)
  return resp.json()
}

export async function clearTransactions(): Promise<void> {
  const resp = await apiFetch('/api/data/clear-transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: true }),
  })
  if (!resp.ok) throw new Error(`Failed to clear transactions: ${resp.status}`)
}
