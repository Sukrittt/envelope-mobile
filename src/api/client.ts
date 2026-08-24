// Ported from Web/src/services/api.ts's apiFetch, aimed at the deployed API
// instead of Next.js's own relative-path routes.
import { clearAccess, currentAccessToken, getValidToken } from './accessMode'

// A dev build with no API URL set would otherwise silently point at
// production data (see the fallback below) with no warning — fail loudly
// instead. Release builds keep the fallback: it's the intended default when
// EXPO_PUBLIC_API_URL isn't baked in.
if (__DEV__ && !process.env.EXPO_PUBLIC_API_URL) {
  throw new Error('EXPO_PUBLIC_API_URL is not set. Set it in Mobile/.env for local development.')
}

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://ynab-replacement.vercel.app'

const REQUEST_TIMEOUT_MS = 15_000

/**
 * The token is fetched (and refreshed if stale) per request, so this must be
 * awaited — the old synchronous password lookup had nothing to refresh.
 * Signed-out callers send no header and the API answers as the demo user.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getValidToken()
  const resp = await fetch(`${BASE_URL}${path}`, {
    ...init,
    // RN's fetch has no default timeout — without this, a hung connection
    // pins a screen's loading state forever. Callers already surface a
    // thrown error as a generic "check your connection" state, so a timeout
    // (which throws an AbortError, same as any other network failure) needs
    // no special handling here.
    signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })

  await handleUnauthorized(resp, token)
  return resp
}

/**
 * On a 401, drops the session if the token that drew it is still the live
 * session's. Shared by apiFetch above and streamChat (src/api/ai.ts), which
 * bypasses apiFetch (it needs expo/fetch for streaming) but must not skip
 * this — a revoked session on that endpoint used to never log the user out.
 *
 * A 401 means the token was rejected server-side despite still looking
 * locally valid (clock skew, a session revoked elsewhere) — getValidToken()
 * only refreshes against the locally cached expiry, so retrying would just
 * resend the same dead token. Drop the session instead and hand the 401 back:
 * app/_layout.tsx's query-cache listener turns it into a sign-in bounce.
 *
 * Deliberately NOT retried without the header. The API answers a
 * credential-less request with the demo account's data at 200, so a retry
 * renders the demo account on screen while the logout bounce is still in
 * flight — the "why am I seeing demo data" flash.
 *
 * Only clear when the token that drew the 401 is still the live session's: a
 * request fired just before a sign-in or refresh can land its stale 401 after
 * a fresher session took over, and clearing then would log the user straight
 * back out of the session that just replaced it.
 */
export async function handleUnauthorized(resp: Response, token: string | null): Promise<void> {
  if (resp.status === 401 && token && token === currentAccessToken()) {
    await clearAccess()
  }
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
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  return resp.ok
}
