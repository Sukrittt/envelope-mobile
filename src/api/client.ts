// Ported from Web/src/services/api.ts's apiFetch, aimed at the deployed API
// instead of Next.js's own relative-path routes.
import { clearAccess, currentAccessToken, getValidToken } from './accessMode'

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://ynab-replacement.vercel.app'

/**
 * The token is fetched (and refreshed if stale) per request, so this must be
 * awaited — the old synchronous password lookup had nothing to refresh.
 * Signed-out callers send no header and the API answers as the demo user.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getValidToken()
  const resp = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })

  // A 401 means the token was rejected server-side despite still looking
  // locally valid (clock skew, a session revoked elsewhere) — getValidToken()
  // only refreshes against the locally cached expiry, so retrying would just
  // resend the same dead token. Drop the session instead and hand the 401 back:
  // app/_layout.tsx's query-cache listener turns it into a sign-in bounce.
  //
  // Deliberately NOT retried without the header. The API answers a
  // credential-less request with the demo account's data at 200, so a retry
  // renders the demo account on screen while the logout bounce is still in
  // flight — the "why am I seeing demo data" flash.
  //
  // Only clear when the token that drew the 401 is still the live session's: a
  // request fired just before a sign-in or refresh can land its stale 401 after
  // a fresher session took over, and clearing then would log the user straight
  // back out of the session that just replaced it.
  if (resp.status === 401 && token && token === currentAccessToken()) {
    await clearAccess()
  }
  return resp
}

/** Reads a `{error}` JSON body if present, falling back to a generic message. */
export async function apiErrorMessage(resp: Response, fallback: string): Promise<string> {
  try {
    const body = await resp.json()
    if (body && typeof body.error === 'string') return body.error
  } catch {
    // non-JSON body, fall through
  }
  return `${fallback}: ${resp.status}`
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
