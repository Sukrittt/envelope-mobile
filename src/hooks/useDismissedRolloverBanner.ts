import { useEffect, useRef, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import { accessMode } from '@/src/api/accessMode'

/**
 * Whether the "left over from last month" banner has been dismissed,
 * remembered on this device. Drop-in for `useState(false)` — same tuple,
 * same setter. Keyed by the month the banner is about, so next month's
 * banner starts undismissed on its own without any reset logic here.
 */
export function useDismissedRolloverBanner(monthKey: string) {
  const [dismissed, setDismissed] = useState(false)
  // Nothing is written until the stored value has landed — the initial
  // false would otherwise overwrite it on every mount.
  const hydrated = useRef(false)
  const key = `mc-rollover-dismissed-${monthKey}`

  useEffect(() => {
    hydrated.current = false
    SecureStore.getItemAsync(key)
      .then((raw) => {
        setDismissed(raw === '1')
      })
      .catch(() => {})
      .finally(() => {
        hydrated.current = true
      })

    // Otherwise the next account signed into on this device inherits the
    // previous one's dismissal.
    return accessMode.subscribeLogout(() => {
      hydrated.current = false
      setDismissed(false)
      SecureStore.deleteItemAsync(key).catch(() => {})
    })
  }, [key])

  useEffect(() => {
    if (!hydrated.current) return
    if (dismissed) SecureStore.setItemAsync(key, '1').catch(() => {})
  }, [dismissed, key])

  return [dismissed, setDismissed] as const
}
