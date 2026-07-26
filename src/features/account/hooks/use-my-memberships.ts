import { useAuth } from '@/providers/auth-provider'
import { useQuery } from '@tanstack/react-query'
import { getMyWorkspaceMemberships } from '../api/profile'
import { accountQueryKeys } from '../api/query-keys'

const ANONYMOUS = 'anonymous'

export function useMyMemberships() {
  const { user } = useAuth()
  const userId = user?.id

  return useQuery({
    queryKey: accountQueryKeys.memberships(userId ?? ANONYMOUS),
    queryFn: () => getMyWorkspaceMemberships(userId as string),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })
}
