import { useEffect, useRef, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import { accessMode } from '@/src/api/accessMode'

/**
 * Which group headers are collapsed on a screen, remembered on this device.
 * Drop-in for `useState<Set<string>>(new Set())` — same tuple, same setter.
 *
 * Persisted via SecureStore because that is the store every other local
 * preference already uses (ThemeProvider, PrivacyContext); the value is a UI
 * choice, not a secret. `screen` namespaces it, so home and envelopes keep
 * their own choice rather than fighting over one key.
 */
export function useCollapsedGroups(screen: string) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  // Nothing is written until the stored value has landed — the initial empty
  // set would otherwise overwrite it on every mount.
  const hydrated = useRef(false)
  const key = `mc-collapsed-${screen}`

  useEffect(() => {
    SecureStore.getItemAsync(key)
      .then((raw) => {
        if (raw) setCollapsed(new Set(JSON.parse(raw) as string[]))
      })
      .catch(() => {})
      .finally(() => {
        hydrated.current = true
      })

    // Otherwise the next account signed into on this device inherits the
    // previous one's collapsed groups.
    return accessMode.subscribeLogout(() => {
      hydrated.current = false
      setCollapsed(new Set())
      SecureStore.deleteItemAsync(key).catch(() => {})
    })
  }, [key])

  useEffect(() => {
    if (!hydrated.current) return
    SecureStore.setItemAsync(key, JSON.stringify([...collapsed])).catch(() => {})
  }, [collapsed, key])

  return [collapsed, setCollapsed] as const
}
