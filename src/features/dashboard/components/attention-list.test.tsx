import type { AttentionItem } from '@/features/dashboard/api/attention-queue'
import type { Workspace } from '@/entities/workspace'
import { m } from '@/paraglide/messages'
import { setLocale } from '@/paraglide/runtime'
import { renderWithQueryClient } from '@/test/render'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AttentionList } from './attention-list'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  }
})

const WORKSPACES: Array<Workspace> = []

function renderList(props: Partial<Parameters<typeof AttentionList>[0]> = {}) {
  return renderWithQueryClient(
    <AttentionList
      items={[]}
      total={0}
      workspaces={WORKSPACES}
      isLoading={false}
      isError={false}
      onRetry={vi.fn()}
      inboxWorkspaceId={null}
      {...props}
    />,
  )
}

const item: AttentionItem = {
  conversationId: 'c1',
  workspaceId: 'w1',
  contactId: 'ct1',
  contactName: 'Alice',
  contactAvatarUrl: null,
  channelType: 'telegram',
  channelName: 'Support',
  reason: 'unread',
  timestamp: '2026-05-15T10:00:00Z',
}

describe('AttentionList', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
  })

  /**
   * The summary line under the greeting and this section read the same numbers.
   * At zero they both rendered an all-clear, so the home page stated the same
   * fact three times inside 100px: the summary sentence, this section's
   * heading, and this section's own empty state.
   */
  it('stays silent when the summary above already reported the all-clear', () => {
    renderList({ isSummaryAllClear: true })
    expect(screen.queryByText(m.home_attention_title())).toBeNull()
    expect(screen.queryByText(m.home_attention_empty_title())).toBeNull()
  })

  it('speaks for itself when the summary could not load', () => {
    renderList({ isSummaryAllClear: false })
    expect(screen.getByText(m.home_attention_title())).toBeTruthy()
    expect(screen.getByText(m.home_attention_empty_title())).toBeTruthy()
  })

  it('still renders its queue while the summary is all clear', () => {
    // Guards the suppression: it keys on emptiness, not on the flag alone, so
    // a stale summary can never hide work that is actually waiting.
    renderList({ items: [item], total: 1, isSummaryAllClear: true })
    expect(screen.getByText(m.home_attention_title())).toBeTruthy()
    expect(screen.getByText('Alice')).toBeTruthy()
  })

  it('still surfaces its own failure while the summary is all clear', () => {
    renderList({ isError: true, isSummaryAllClear: true })
    expect(screen.getByText(m.home_attention_error())).toBeTruthy()
  })
})
