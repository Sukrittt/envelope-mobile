// Session state for the app. Holds a WorkOS token pair in SecureStore
// (Keychain/Keystore) instead of the shared dashboard password it used to hold.
//
// The in-memory copy stays synchronous so subscribers can read it during render,
// but token access is async: `getValidToken()` may need a network round-trip to
// refresh, so every caller must await it.
import * as SecureStore from 'expo-secure-store'
import { WorkOSHttpError, refreshTokens, tokenExpiry, tokenUserId, type WorkOSTokens } from './workos'

export type AccessMode = 'real' | 'guest'

// New key: a stored value under the old key is a bare password from the
// pre-WorkOS build and must be ignored rather than misread as a token.
const STORAGE_KEY = 'mc-session'

/** Refresh this far before actual expiry, so a request never races the clock. */
const REFRESH_MARGIN_MS = 60 * 1000

let mode: AccessMode = 'guest'
let session: WorkOSTokens | null = null
const subs = new Set<(m: AccessMode) => void>()
const logoutSubs = new Set<() => void>()

export const accessMode = {
  subscribe(fn: (m: AccessMode) => void): () => void {
    subs.add(fn)
    return () => subs.delete(fn)
  },
  subscribeLogout(fn: () => void): () => void {
    logoutSubs.add(fn)
    return () => logoutSubs.delete(fn)
  },
}

function notify() {
  for (const fn of subs) fn(mode)
}

async function store(next: WorkOSTokens | null): Promise<void> {
  session = next
  mode = next ? 'real' : 'guest'
  try {
    if (next) await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next))
    else await SecureStore.deleteItemAsync(STORAGE_KEY)
  } catch {
    // Storage unavailable — the session just won't survive a relaunch.
  }
  notify()
}

/** Save a freshly issued token pair and switch to real mode. */
export function persistSession(tokens: WorkOSTokens): Promise<void> {
  return store(tokens)
}

/**
 * Call once at app boot. Restores a stored session and returns 'real'
 * immediately from the blob alone — a device holding a session is signed in
 * regardless of whether the network is up to prove it to WorkOS right now.
 * A long-backgrounded app comes back with a dead access token, so a refresh
 * is still kicked off in the background to renew it before the first data
 * request; a transport failure there must not clear the session (getValidToken
 * already only clears on a real 4xx). Returns null only when there is no
 * stored session at all, or it's malformed.
 */
export async function initAccessMode(): Promise<AccessMode | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as WorkOSTokens
    if (!parsed?.accessToken || !parsed?.refreshToken) return null
    session = parsed
    mode = 'real'
    notify()
    void getValidToken()
    return 'real'
  } catch {
    return null
  }
}

// One in-flight refresh at a time: several queries fire on mount, and two
// concurrent refreshes would race, with the loser's rotated token already dead.
let refreshing: Promise<string | null> | null = null

/**
 * A usable access token, refreshing first if it is expired or about to be.
 * Returns null when there is no session, or the refresh failed. Only a real
 * 4xx from WorkOS (the token itself rejected) clears the session — a
 * transport failure (offline) leaves it intact and just returns null, so an
 * offline device stays signed in instead of losing its credential.
 */
export async function getValidToken(): Promise<string | null> {
  if (!session) return null
  if (Date.now() < session.expiresAt - REFRESH_MARGIN_MS) return session.accessToken

  if (!refreshing) {
    refreshing = (async () => {
      try {
        const next = await refreshTokens(session!.refreshToken)
        // WorkOS rotates refresh tokens; storing the new pair is mandatory.
        await store({ ...next, expiresAt: next.expiresAt || tokenExpiry(next.accessToken) })
        return next.accessToken
      } catch (err) {
        if (err instanceof WorkOSHttpError && err.status >= 400 && err.status < 500) {
          await clearAccess()
        }
        return null
      } finally {
        refreshing = null
      }
    })()
  }
  return refreshing
}

/** The raw access token held in memory right now, without refreshing. */
export function currentAccessToken(): string | null {
  return session?.accessToken ?? null
}

/** The signed-in user's WorkOS id (`sub`), or null when signed out. */
export function currentUserId(): string | null {
  return session ? tokenUserId(session.accessToken) : null
}

/** The current session id (`sid`), needed to end the session on WorkOS's side. */
export function sessionId(): string | null {
  if (!session) return null
  try {
    const payload = session.accessToken.split('.')[1]
    if (!payload) return null
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).sid ?? null
  } catch {
    return null
  }
}

/**
 * Log out locally: drop the stored session, fall back to guest, re-lock the app.
 * Always succeeds — a user must be able to sign out of this device regardless
 * of network.
 *
 * Ending the session on WorkOS's side is the caller's job: `revokeSession()` in
 * ./account, awaited *before* this, while the bearer token is still live. Most
 * callers (a 401, a failed token refresh) are reacting to a session the server
 * already killed and need no revoke at all.
 *
 * This deliberately does NOT ping `/user_management/sessions/logout` — that is a
 * browser endpoint answering 302 to a post-logout redirect URI, and RN's fetch
 * throws following it, which reported every single sign-out as a failure.
 */
export async function clearAccess(): Promise<void> {
  await store(null)
  for (const fn of logoutSubs) fn()
}
