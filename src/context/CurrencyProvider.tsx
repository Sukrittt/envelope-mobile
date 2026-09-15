import { useEffect, type ReactNode } from 'react'
import { AppState } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { getUser } from '@/src/api/account'
import { CurrencyScope } from './CurrencyContext'

export function CurrencyProvider({ enabled, initialCurrency = 'INR', children }: { initialCurrency?: string; enabled: boolean; children: ReactNode }) {
  const profile = useQuery({ queryKey: ['user'], queryFn: getUser, enabled, staleTime: 30_000 })
  const { refetch } = profile
  useEffect(() => {
    if (!enabled) return
    const sub = AppState.addEventListener('change', state => { if (state === 'active') void refetch() })
    return () => sub.remove()
  }, [enabled, refetch])
  return <CurrencyScope code={enabled ? profile.data?.currencyCode ?? initialCurrency : 'INR'}>{children}</CurrencyScope>
}
