import { useSyncExternalStore } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { currentUserId } from '@/src/api/accessMode'

// Module-level online flag, flipped by apiFetch (client.ts) itself: false the
// instant a request throws a transport error (TypeError/AbortError), true on
// any response at all (even a 4xx — that means the network is up, the server
// just said no). No NetInfo/expo-network: the request path already produces
// this signal, and a background dependency would only ever confirm the same
// thing apiFetch already knows moments later. Same idiom as
// useLogExpenseSubmit.ts's external store.
let online = true
const listeners = new Set<() => void>()
const onlineTransitionListeners = new Set<() => void>()

export function setOnline(next: boolean): void {
  if (next === online) return
  online = next
  listeners.forEach((l) => l())
  if (next) onlineTransitionListeners.forEach((l) => l())
}

/** Fires only on a false -> true transition — "we were offline, and now the network answered". */
export function onOnlineTransition(fn: () => void): () => void {
  onlineTransitionListeners.add(fn)
  return () => onlineTransitionListeners.delete(fn)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): boolean {
  return online
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function isOnline(): boolean {
  return online
}

// Namespaced per user (like categoryCache/pendingExpenses) so signing out and
// back in as someone else doesn't show their predecessor's sync time.
const SYNC_PREFIX = 'mc-last-synced'

function syncedKey(): string | null {
  const uid = currentUserId()
  return uid ? `${SYNC_PREFIX}:${uid}` : null
}

/** Called by apiFetch on every successful response, so OfflineScreen can show
 * "last synced" from the most recent moment the app actually reached the server. */
export async function markSynced(): Promise<void> {
  const key = syncedKey()
  if (!key) return
  await AsyncStorage.setItem(key, String(Date.now()))
}

export async function readLastSynced(): Promise<number | null> {
  const key = syncedKey()
  if (!key) return null
  const raw = await AsyncStorage.getItem(key)
  return raw ? Number(raw) : null
}
