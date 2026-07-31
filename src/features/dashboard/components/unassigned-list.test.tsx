import type { Workspace } from '@/entities/workspace'
import type { UnassignedItem } from '@/features/dashboard/api/attention-queue'
import { m } from '@/paraglide/messages'
import { setLocale } from '@/paraglide/runtime'
import { renderWithQueryClient } from '@/test/render'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnassignedList } from './unassigned-list'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    Link: ({
      children,
      params,
    }: {
      children: React.ReactNode
      params?: Record<string, string>
    }) => <a data-params={JSON.stringify(params)}>{children}</a>,
  }
})

const item: UnassignedItem = {
  conversationId: 'c1',
  workspaceId: 'w1',
  contactName: 'Boris',
  channelType: 'telegram',
  timestamp: '2026-05-15T10:00:00Z',
  preview: 'Hi, do you deliver on weekends?',
}

const workspaces: Array<Workspace> = []

function renderList(props: Partial<Parameters<typeof UnassignedList>[0]> = {}) {
  return renderWithQueryClient(
    <UnassignedList
      items={[]}
      total={0}
      workspaces={workspaces}
      isPending={false}
      isError={false}
      onRetry={vi.fn()}
      {...props}
    />,
  )
}

describe('UnassignedList', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
  })

  it('names the section after its query: unassigned open conversations', () => {
    renderList({ items: [item] })
    expect(screen.getByText(m.home_unassigned_title())).toBeTruthy()
  })

  // The section used to render nothing while its query was in flight, so it
  // appeared late and pushed the workspace section down the page. It now
  // holds its slot with a placeholder, and collapses only once it knows the
  // answer is "nothing waiting".
  it('holds its slot while pending, then collapses when empty', () => {
    const pending = renderList({ isPending: true })
    expect(screen.getByText(m.home_unassigned_title())).toBeTruthy()
    pending.unmount()

    renderList({ items: [] })
    expect(screen.queryByText(m.home_unassigned_title())).toBeNull()
  })

  it('explains what qualifies on the page, not only in a hover tooltip', () => {
    renderList({ items: [item] })
    expect(screen.getByText(m.home_unassigned_hint())).toBeTruthy()
  })

  it('does not hide a query failure behind the empty state', () => {
    renderList({ isError: true })
    expect(screen.getByText(m.home_unassigned_error())).toBeTruthy()
  })

  it('shows the message preview and links to the conversation', () => {
    renderList({ items: [item] })
    expect(screen.getByText('Hi, do you deliver on weekends?')).toBeTruthy()
    const link = screen.getByText('Boris').closest('a')
    expect(link?.dataset.params).toBe(
      JSON.stringify({ id: 'w1', conversationId: 'c1' }),
    )
  })
})
