import { dashboardQueryKeys } from '@/features/dashboard/api/dashboard-stats'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

/**
 * Marks every home-page query stale.
 *
 * Home reads three queries — the summary counts, the attention queue, and the
 * per-workspace stats — and all three describe the same conversations the inbox
 * mutates. They are keyed under the shared `['dashboard']` root precisely so one
 * call covers them, including the user-scoped and workspace-scoped variants.
 *
 * Callers are inbox mutations and the notifications realtime handler, which
 * change conversation state while home is unmounted. Without this, home is
 * served from cache on the next visit and contradicts the inbox the user just
 * cleared. Invalidating an unmounted query costs nothing: React Query marks it
 * stale and refetches on the next mount rather than issuing a request now.
 */
export function useInvalidateDashboard() {
  const queryClient = useQueryClient()

  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all })
  }, [queryClient])
}
