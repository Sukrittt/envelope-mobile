// Shared "hide amounts" toggle so Home (Package B) and More (Package E) read/write
// the same boolean instead of each keeping a local copy. No persistence — resets
// on app restart, matching the plan's "keep it minimal" instruction.
import { createContext, useContext, useState, useMemo } from 'react'

interface PrivacyContextValue {
  hideAmounts: boolean
  setHideAmounts: (value: boolean) => void
}

const PrivacyContext = createContext<PrivacyContextValue | null>(null)

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [hideAmounts, setHideAmounts] = useState(false)
  const value = useMemo(() => ({ hideAmounts, setHideAmounts }), [hideAmounts])
  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>
}

export function usePrivacy(): PrivacyContextValue {
  const ctx = useContext(PrivacyContext)
  if (!ctx) throw new Error('usePrivacy must be used within a PrivacyProvider')
  return ctx
}
