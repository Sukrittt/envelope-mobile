// Ported from Web/src/services/accessMode.ts. Same real/guest singleton + pub/sub
// shape, but SecureStore has no sync API (unlike localStorage), so persist/read
// become async — callers must await `initAccessMode()` once at app boot before
// rendering past the splash screen, instead of reading synchronously like web does.
import * as SecureStore from 'expo-secure-store'

export type AccessMode = 'real' | 'guest'

const STORAGE_KEY = 'mc-access'
const SESSION_MS = 30 * 24 * 60 * 60 * 1000 // ~30 days

interface StoredAccess {
  mode: AccessMode
  token: string | null
  expiresAt: number
}

let mode: AccessMode = 'guest'
let token: string | null = null
const subs = new Set<(m: AccessMode) => void>()
const logoutSubs = new Set<() => void>()

export const accessMode = {
  get: () => mode,
  getToken: () => token,
  subscribe(fn: (m: AccessMode) => void): () => void {
    subs.add(fn)
    return () => subs.delete(fn)
  },
  subscribeLogout(fn: () => void): () => void {
    logoutSubs.add(fn)
    return () => logoutSubs.delete(fn)
  },
}

export function isGuest(): boolean {
  return mode === 'guest'
}

/** Persist real/guest choice (+ bearer token for real mode) for up to 30 days. */
export async function persistAccess(next: AccessMode, nextToken: string | null = null): Promise<void> {
  mode = next
  token = next === 'real' ? nextToken : null
  try {
    const stored: StoredAccess = { mode, token, expiresAt: Date.now() + SESSION_MS }
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(stored))
  } catch {
    // Storage unavailable — the session just won't survive reloads.
  }
  for (const fn of subs) fn(mode)
}

/**
 * Call once at app boot: restores a still-valid persisted session. Returns
 * null when there is no valid session (first launch, expired, cleared) so
 * the caller can tell "never chose" apart from the in-memory default.
 */
export async function initAccessMode(): Promise<AccessMode | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredAccess
    if (parsed?.mode !== 'real' && parsed?.mode !== 'guest') return null
    if (typeof parsed.expiresAt !== 'number' || parsed.expiresAt < Date.now()) {
      await SecureStore.deleteItemAsync(STORAGE_KEY)
      return null
    }
    mode = parsed.mode
    token = parsed.token ?? null
    for (const fn of subs) fn(mode)
    return mode
  } catch {
    return null
  }
}

/** Log out: drop persisted session, fall back to guest, re-lock the app. */
export async function clearAccess(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEY)
  } catch {
    // ignore
  }
  mode = 'guest'
  token = null
  for (const fn of subs) fn(mode)
  for (const fn of logoutSubs) fn()
}
