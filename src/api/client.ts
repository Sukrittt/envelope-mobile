// Ported from Web/src/services/api.ts's apiFetch, aimed at the deployed API
// instead of Next.js's own relative-path routes.
import { clearAccess, getValidToken } from './accessMode'

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
  // A 401 means the token died between the expiry check and the request, or
  // was rejected server-side despite still looking locally valid (clock
  // skew, a session revoked elsewhere). getValidToken() only refreshes based
  // on the locally cached expiry, so it would resend the same dead token —
  // clear the session first so the retry goes out with none, which the
  // server now answers as demo/guest rather than repeating the same 401.
  // The caller still sees this first 401 surface as an error either way,
  // which app/_layout.tsx's query-cache listener turns into a sign-in bounce.
  if (resp.status === 401) {
    await clearAccess()
    return send()
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
