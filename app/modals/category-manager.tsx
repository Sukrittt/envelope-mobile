import { useEffect } from 'react'
import { useRouter } from 'expo-router'

// Package B already built a full category/group manager as a real tab screen
// (app/(tabs)/envelopes.tsx) — more room to work with than a modal sheet gives.
// This route just redirects there so any router.push('/modals/category-manager')
// caller lands somewhere sensible, instead of duplicating that screen.
export default function CategoryManagerModal() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/(tabs)/envelopes')
  }, [router])
  return null
}
