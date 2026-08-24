import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { darkTokens, lightTokens, type ThemeTokens } from './tokens'
import { accessMode } from '../api/accessMode'

type ThemePreference = 'light' | 'dark' | 'system'

const PREF_KEY = 'mc-theme-pref'

interface ThemeContextValue {
  scheme: 'light' | 'dark'
  tokens: ThemeTokens
  preference: ThemePreference
  setPreference: (pref: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const rawScheme = useColorScheme()
  const systemScheme: 'light' | 'dark' = rawScheme === 'light' ? 'light' : 'dark'
  const [preference, setPreferenceState] = useState<ThemePreference>('system')

  useEffect(() => {
    SecureStore.getItemAsync(PREF_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored)
      }
    })
    // Otherwise the next account signed into on this device inherits
    // whatever the previous one set.
    return accessMode.subscribeLogout(() => {
      setPreferenceState('system')
      SecureStore.deleteItemAsync(PREF_KEY).catch(() => {})
    })
  }, [])

  const setPreference = (pref: ThemePreference) => {
    setPreferenceState(pref)
    SecureStore.setItemAsync(PREF_KEY, pref).catch(() => {})
  }

  const scheme = preference === 'system' ? systemScheme : preference
  const tokens = scheme === 'dark' ? darkTokens : lightTokens

  const value = useMemo(
    () => ({ scheme, tokens, preference, setPreference }),
    [scheme, tokens, preference],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
