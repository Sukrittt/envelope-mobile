// Ported from Web/src/services/api.ts's apiFetch, aimed at the deployed API
// instead of Next.js's own relative-path routes.
import { accessMode, isGuest } from './accessMode'

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://ynab-replacement.vercel.app'

function authHeaders(): Record<string, string> {
  const token = accessMode.getToken()
  if (isGuest() || !token) return {}
  return { Authorization: `Bearer ${token}` }
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  })
}

/** Verifies a password works as a bearer token against the real API before storing it. */
export async function verifyToken(candidateToken: string): Promise<boolean> {
  const resp = await fetch(`${BASE_URL}/api/auth/verify`, {
    headers: { Authorization: `Bearer ${candidateToken}` },
  })
  return resp.ok
}
