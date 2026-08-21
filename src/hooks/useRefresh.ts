import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'

/** Pull-to-refresh for a screen's ScrollView: refetch everything currently mounted. */
export function useRefresh() {
  const qc = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    setRefreshing(true)
    try {
      await qc.refetchQueries({ type: 'active' })
    } finally {
      setRefreshing(false)
    }
  }

  return { refreshing, onRefresh }
}
