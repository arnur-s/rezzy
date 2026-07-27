import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { queryClient } from './query-client'

/**
 * Pins the shared client's defaults to the behaviour the route gates depend on.
 *
 * `_authenticated` and the inbox layout both mount a query on entry and render
 * a spinner while it is pending. With React Query's own default of
 * `staleTime: 0`, every navigation refetched and flashed that spinner over data
 * fetched seconds earlier. These assert the fix at the level it was made, so
 * the value cannot quietly revert to the library default.
 */
describe('shared query client', () => {
  it('does not refetch a fresh query when a route remounts it', async () => {
    const queryFn = vi.fn().mockResolvedValue('workspaces')
    const key = ['route-gate-remount']

    function Gate() {
      const { data } = useQuery({ queryKey: key, queryFn })
      return <span>{data ?? 'pending'}</span>
    }

    const view = render(
      <QueryClientProvider client={queryClient}>
        <Gate />
      </QueryClientProvider>,
    )
    await waitFor(() => expect(screen.getByText('workspaces')).toBeDefined())
    expect(queryFn).toHaveBeenCalledTimes(1)

    // Leaving and re-entering a route unmounts and remounts its gate.
    view.unmount()
    render(
      <QueryClientProvider client={queryClient}>
        <Gate />
      </QueryClientProvider>,
    )

    // The gate resolves from cache, so it never renders a pending state and
    // never issues a second request.
    expect(screen.getByText('workspaces')).toBeDefined()
    expect(queryFn).toHaveBeenCalledTimes(1)

    queryClient.removeQueries({ queryKey: key })
  })

  it('keeps a stale window long enough to cover a navigation', () => {
    const { staleTime } = queryClient.getDefaultOptions().queries ?? {}
    expect(staleTime).toBeGreaterThanOrEqual(30_000)
  })
})
