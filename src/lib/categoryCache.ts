import AsyncStorage from '@react-native-async-storage/async-storage'
import { currentUserId } from '@/src/api/accessMode'
import type { CategoryRow } from '@/src/types'

const PREFIX = 'mc-category-cache'

function key(): string | null {
  const uid = currentUserId()
  return uid ? `${PREFIX}:${uid}` : null
}

/** Reads the last-known category list for the signed-in user, or null (guest, or never cached). */
export async function readCategoryCache(): Promise<CategoryRow[] | null> {
  const k = key()
  if (!k) return null
  const raw = await AsyncStorage.getItem(k)
  if (!raw) return null
  try {
    return JSON.parse(raw) as CategoryRow[]
  } catch {
    return null
  }
}

/** Written on every successful fetch and every category mutation, so cache and server never drift. */
export async function writeCategoryCache(categories: CategoryRow[]): Promise<void> {
  const k = key()
  if (!k) return
  await AsyncStorage.setItem(k, JSON.stringify(categories))
}
