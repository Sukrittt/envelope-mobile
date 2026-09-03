import { WrappedScreen } from '@/src/components/wrapped/WrappedScreen'
import { OfflineScreen } from '@/src/components/shared/OfflineScreen'
import { useOnline } from '@/src/lib/netStatus'

export default function WrappedRoute() {
  const online = useOnline()
  if (!online) return <OfflineScreen />
  return <WrappedScreen />
}
