// Ported from Web/src/services/api.ts's apiFetch, aimed at the deployed API
// instead of Next.js's own relative-path routes.
import { getValidToken } from './accessMode'

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://ynab-replacement.vercel.app'

/**
 * The token is fetched (and refreshed if stale) per request, so this must be
 * awaited — the old synchronous password lookup had nothing to refresh.
 * Signed-out callers send no header and the API answers as the demo user.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const send = async () => {
    const token = await getValidToken()
    return fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    })
  }

  const resp = await send()
  // A 401 means the token died between the expiry check and the request
  // (clock skew, a revoked session). getValidToken() will have cleared the
  // session by then, so one retry either succeeds or falls through to demo.
  if (resp.status === 401) return send()
  return resp
}

/** Confirms the stored session is still accepted by the API. */
export async function verifySession(): Promise<boolean> {
  const token = await getValidToken()
  if (!token) return false
  const resp = await fetch(`${BASE_URL}/api/auth/verify`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return resp.ok
}
