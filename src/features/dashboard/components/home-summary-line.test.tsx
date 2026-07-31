import { m } from '@/paraglide/messages'
import { setLocale } from '@/paraglide/runtime'
import { renderWithQueryClient } from '@/test/render'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HomeSummaryLine } from './home-summary-line'

const ZERO = {
  unreadAssigned: 0,
  openAssigned: 0,
  snoozedWaking: 0,
  staleAssigned: 0,
}

function render(props: Partial<Parameters<typeof HomeSummaryLine>[0]> = {}) {
  return renderWithQueryClient(
    <HomeSummaryLine
      stats={ZERO}
      isPending={false}
      isError={false}
      onRetry={vi.fn()}
      {...props}
    />,
  )
}

describe('HomeSummaryLine', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
  })

  it('celebrates only when nothing is waiting on anyone', () => {
    render()
    expect(screen.getByText(m.home_summary_all_clear())).toBeTruthy()
  })

  // The all-clear reads the agent's own numbers, so it could announce calm
  // directly above a list of customers nobody had picked up. The scoping word
  // ("assigned to you") was doing load-bearing work no scanner notices.
  it('does not claim all-clear while conversations sit unclaimed', () => {
    render({ unassignedCount: 3 })
    expect(screen.queryByText(m.home_summary_all_clear())).toBeNull()
    expect(
      screen.getByText(m.home_summary_all_clear_unassigned({ count: 3 })),
    ).toBeTruthy()
  })

  it('reports each state with its own threshold, not a hover-only hint', () => {
    render({
      stats: { ...ZERO, staleAssigned: 2, snoozedWaking: 1 },
    })
    // The thresholds are part of the visible sentence; a `title` attribute is
    // unreachable on touch and unreliable on a non-interactive span.
    expect(screen.getByText(m.home_summary_stale({ count: 2 }))).toBeTruthy()
    expect(screen.getByText(m.home_summary_waking({ count: 1 }))).toBeTruthy()
    expect(document.querySelector('[title]')).toBeNull()
  })

  it('reports a failure instead of rendering a confident all-clear', () => {
    render({ isError: true, stats: undefined })
    expect(screen.getByText(m.home_summary_error())).toBeTruthy()
    expect(screen.queryByText(m.home_summary_all_clear())).toBeNull()
  })

  it('shows a placeholder rather than fake zeros while loading', () => {
    render({ isPending: true, stats: undefined })
    expect(screen.queryByText(m.home_summary_all_clear())).toBeNull()
  })
})
