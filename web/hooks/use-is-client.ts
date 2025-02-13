import { useEffect } from 'react'
import { usePersistentInMemoryState } from 'client-common/hooks/use-persistent-in-memory-state'

export const useIsClient = () => {
  const [isClient, setIsClient] = usePersistentInMemoryState(false, 'is-client')
  useEffect(() => setIsClient(true), [setIsClient])
  return isClient
}
