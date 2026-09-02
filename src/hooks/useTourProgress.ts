import { useEffect, useRef, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import { accessMode } from '@/src/api/accessMode'

const KEY = 'mc-tour-done'

/**
 * Which guided-tour chapters have been completed, remembered on this device.
 * Drop-in for `useState<Set<number>>(new Set())` — same tuple, same setter.
 *
 * SecureStore for the same reason as useCollapsedGroups: it is where every
 * other local preference already lives, and this is a UI choice, not a secret.
 */
export function useTourProgress() {
  const [done, setDone] = useState<Set<number>>(new Set())
  // Nothing is written until the stored value has landed — the initial empty
  // set would otherwise overwrite it on every mount.
  const hydrated = useRef(false)

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((raw) => {
        if (raw) setDone(new Set(JSON.parse(raw) as number[]))
      })
      .catch(() => {})
      .finally(() => {
        hydrated.current = true
      })

    // Otherwise the next account signed into on this device inherits the
    // previous one's progress.
    return accessMode.subscribeLogout(() => {
      hydrated.current = false
      setDone(new Set())
      SecureStore.deleteItemAsync(KEY).catch(() => {})
    })
  }, [])

  useEffect(() => {
    if (!hydrated.current) return
    SecureStore.setItemAsync(KEY, JSON.stringify([...done])).catch(() => {})
  }, [done])

  return [done, setDone] as const
}
