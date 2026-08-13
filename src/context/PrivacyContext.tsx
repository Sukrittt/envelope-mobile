// Shared "hide amounts" toggle so every screen reads/writes the same boolean
// instead of each keeping a local copy. Persisted via SecureStore, matching
// ThemeProvider's pattern.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as SecureStore from 'expo-secure-store'

const PREF_KEY = 'mc-hide-amounts'

interface PrivacyContextValue {
  hideAmounts: boolean
  setHideAmounts: (value: boolean) => void
}

const PrivacyContext = createContext<PrivacyContextValue | null>(null)

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hideAmounts, setHideAmountsState] = useState(false)

  useEffect(() => {
    SecureStore.getItemAsync(PREF_KEY).then((stored) => {
      if (stored === 'true') setHideAmountsState(true)
    })
  }, [])

  const setHideAmounts = (value: boolean) => {
    setHideAmountsState(value)
    SecureStore.setItemAsync(PREF_KEY, String(value)).catch(() => {})
  }

  const value = useMemo(() => ({ hideAmounts, setHideAmounts }), [hideAmounts])
  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>
}

export function usePrivacy(): PrivacyContextValue {
  const ctx = useContext(PrivacyContext)
  if (!ctx) throw new Error('usePrivacy must be used within a PrivacyProvider')
  return ctx
}
