import type { AttentionItem } from '@/features/dashboard/api/attention-queue'
import type { Workspace } from '@/entities/workspace'
import { m } from '@/paraglide/messages'
import { setLocale } from '@/paraglide/runtime'
import { renderWithQueryClient } from '@/test/render'
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AttentionList } from './attention-list'

const conversationClickMock = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    Link: ({
      children,
      params,
      className,
    }: {
      children: React.ReactNode
      params?: Record<string, string>
      className?: string
    }) => (
      <a
        href="#conversation"
        className={className}
        data-params={JSON.stringify(params)}
        onClick={() => conversationClickMock(params)}
      >
        {children}
      </a>
    ),
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
  preview: 'Sure, sending the invoice now',
}

describe('AttentionList', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
    conversationClickMock.mockClear()
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

  it('shows the latest message preview on the row', () => {
    renderList({ items: [item], total: 1 })
    expect(screen.getByText('Sure, sending the invoice now')).toBeTruthy()
  })

  it('keeps the row link intact when there is no preview to show', () => {
    // No invented text: the preview slot renders empty, and the row still
    // carries name, reason chip, and destination params.
    renderList({ items: [{ ...item, preview: null }], total: 1 })
    expect(screen.getByText('Alice')).toBeTruthy()
    expect(screen.getByText(m.home_attention_reason_unread())).toBeTruthy()
    const link = screen.getByText('Alice').closest('a')
    expect(link?.dataset.params).toBe(
      JSON.stringify({ id: 'w1', conversationId: 'c1' }),
    )
  })

  it('makes the entire row a keyboard-focusable conversation link', () => {
    renderList({ items: [item], total: 1 })
    const link = screen.getByRole('link', { name: /Alice/ })
    expect(link.tabIndex).toBe(0)
    expect(link.className).toContain('focus-visible:ring-2')

    link.focus()
    expect(document.activeElement).toBe(link)
    fireEvent.click(link)
    expect(conversationClickMock).toHaveBeenCalledWith({
      id: 'w1',
      conversationId: 'c1',
    })
  })
})
