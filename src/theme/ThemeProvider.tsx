import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { darkTokens, lightTokens, type ThemeTokens } from './tokens'
import { space, radius, type as type_, motion, elevation } from './scale'

type ThemePreference = 'light' | 'dark' | 'system'

const PREF_KEY = 'mc-theme-pref'

interface ThemeContextValue {
  scheme: 'light' | 'dark'
  tokens: ThemeTokens
  preference: ThemePreference
  setPreference: (pref: ThemePreference) => void
  space: typeof space
  radius: typeof radius
  type: typeof type_
  motion: typeof motion
  elevation: typeof elevation
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const rawScheme = useColorScheme()
  // Light is the default: the design is light-first, and `useColorScheme()`
  // returns null before the native module reports in.
  const systemScheme: 'light' | 'dark' = rawScheme === 'dark' ? 'dark' : 'light'
  const [preference, setPreferenceState] = useState<ThemePreference>('system')

  // Deliberately survives logout: the theme belongs to this device, not to the
  // account. Clearing it threw a user who had picked Light on a dark-mode phone
  // straight into dark the moment they signed out.
  useEffect(() => {
    SecureStore.getItemAsync(PREF_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored)
      }
    })
  }, [])

  const setPreference = (pref: ThemePreference) => {
    setPreferenceState(pref)
    SecureStore.setItemAsync(PREF_KEY, pref).catch(() => {})
  }

  const scheme = preference === 'system' ? systemScheme : preference
  const tokens = scheme === 'dark' ? darkTokens : lightTokens

  const value = useMemo(
    () => ({
      scheme,
      tokens,
      preference,
      setPreference,
      space,
      radius,
      type: type_,
      motion,
      elevation,
    }),
    [scheme, tokens, preference],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
