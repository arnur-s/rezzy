import { QueryClient } from '@tanstack/react-query'

/**
 * Default query behaviour for the app.
 *
 * React Query's own default is `staleTime: 0`, which marks data stale the
 * moment it arrives. Every gated route here (`_authenticated` reads workspaces,
 * the inbox reads channel readiness) mounts a query on entry, so with the
 * default each navigation fires a fresh Supabase round trip and re-renders
 * through a pending gate — a visible flash of the loading spinner on routes
 * whose data was fetched seconds earlier.
 *
 * 30s is chosen against what these queries describe: workspace membership and
 * channel connection state change on human timescales (someone connects a
 * channel, an admin adds a member), not per second. Data that genuinely moves
 * fast — conversations, messages, unread counts — is driven by realtime
 * subscriptions and explicit invalidation, so it does not rely on this window.
 *
 * `refetchOnWindowFocus` stays on: returning to a tab after a while is exactly
 * when a stale workspace or channel list should be re-checked.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // A route gate that flickers between error and loading on a flaky
      // connection is worse than one that waits; two retries with backoff is
      // React Query's default and suits these reads.
      retry: 2,
    },
  },
})
