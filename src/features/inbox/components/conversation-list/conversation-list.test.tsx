import type { ConversationWithRelations } from '@/entities/conversation'
import { setLocale } from '@/paraglide/runtime'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConversationList } from './conversation-list'

vi.mock('@/entities/channel', async () => {
  const actual = await vi.importActual('@/entities/channel')
  return {
    ...actual,
    PlatformIcon: () => <span data-testid="platform-icon" />,
  }
})

type RenderProps = Partial<React.ComponentProps<typeof ConversationList>>

function renderList(overrides: RenderProps = {}) {
  const onSelect = vi.fn()
  const onPrimaryFilterChange = vi.fn()
  const onSearchChange = vi.fn()
  const onRetry = vi.fn()

  const utils = render(
    <ConversationList
      conversations={overrides.conversations ?? []}
      isLoading={overrides.isLoading ?? false}
      isError={overrides.isError ?? false}
      selectedConversationId={overrides.selectedConversationId ?? null}
      onSelect={overrides.onSelect ?? onSelect}
      primaryFilter={overrides.primaryFilter ?? 'all'}
      onPrimaryFilterChange={
        overrides.onPrimaryFilterChange ?? onPrimaryFilterChange
      }
      searchQuery={overrides.searchQuery ?? ''}
      onSearchChange={overrides.onSearchChange ?? onSearchChange}
      userId={overrides.userId ?? 'user-1'}
      onRetry={overrides.onRetry ?? onRetry}
      isRetrying={overrides.isRetrying ?? false}
    />,
  )

  return { ...utils, onSelect, onPrimaryFilterChange, onSearchChange, onRetry }
}

function conversationFixture(
  id: string,
  contactName: string,
): ConversationWithRelations {
  return {
    id,
    workspace_id: 'w',
    channel_id: 'c',
    contact_id: 'p',
    assigned_to: null,
    status: 'open',
    unread_count: 0,
    last_message_at: '2026-05-15T10:00:00Z',
    last_message_preview: 'Hi there',
    snoozed_until: null,
    external_thread_id: null,
    last_inbound_at: null,
    created_at: '2020-01-01',
    updated_at: '2020-01-01',
    channel: { id: 'c', type: 'telegram', name: null },
    contact: {
      id: 'p',
      name: contactName,
      phone: null,
      avatar_url: null,
      status: 'new',
    },
    assigned_profile: null,
  }
}

describe('ConversationList selection', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
  })

  it('calls onSelect when re-clicking the already-selected conversation row', () => {
    const { onSelect } = renderList({
      conversations: [conversationFixture('conv-1', 'Alice')],
      selectedConversationId: 'conv-1',
    })

    fireEvent.click(screen.getByText('Alice'))

    expect(onSelect).toHaveBeenCalledWith('conv-1')
  })

  // The selected row is the primary wayfinding signal in the inbox. The list
  // sits flat on the shell's content sheet, so selection is the shared quiet
  // fill from listItemStyle — a lifted sub-surface belonged to the old
  // floating-pane shell and would read as a stray card here.
  it('marks the selected row with the shared selection fill, not a lifted surface', () => {
    renderList({
      conversations: [
        conversationFixture('conv-1', 'Alice'),
        conversationFixture('conv-2', 'Bob'),
      ],
      selectedConversationId: 'conv-1',
    })

    // Scope to the conversation row: the filter chips above the list are also
    // selectable ListBox items and would otherwise match first.
    const selected = screen.getByText('Alice').closest('[data-selected]')
    expect(selected?.getAttribute('data-selected')).toBe('true')

    const className = selected?.getAttribute('class') ?? ''
    expect(className).toContain('data-[selected=true]:bg-primary/10')
    expect(className).not.toContain('data-[selected=true]:shadow-md')
    // Hover applies only to unselected rows, so it cannot override selection.
    expect(className).toContain('data-[selected=false]:hover:bg-primary/4')
    // Focus is a ring, so it stays visible on top of either state.
    expect(className).toContain('focus-visible:ring-accent')
  })
})

describe('ConversationList polish states', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
  })

  it('renders neither error nor empty state while loading', () => {
    renderList({ isLoading: true, conversations: undefined })

    expect(screen.queryByText(/Could not load conversations/i)).toBeNull()
    expect(screen.queryByText(/Nothing here yet/i)).toBeNull()
    expect(screen.queryByText(/No conversations match/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /Retry/i })).toBeNull()
  })

  it('renders an error alert with a retry button that calls onRetry', () => {
    const { onRetry } = renderList({ isError: true })

    expect(screen.getByText(/Could not load conversations/i)).toBeTruthy()
    const retry = screen.getByRole('button', { name: /Retry/i })
    fireEvent.click(retry)
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('renders the empty-with-filter state with a Clear filters button that resets filter + search', () => {
    const { onPrimaryFilterChange, onSearchChange } = renderList({
      conversations: [],
      primaryFilter: 'mine',
      searchQuery: 'whatever',
    })

    expect(screen.getByText(/No conversations match/i)).toBeTruthy()

    const clear = screen.getByRole('button', { name: /Clear filters/i })
    fireEvent.click(clear)

    expect(onPrimaryFilterChange).toHaveBeenCalledWith('all')
    expect(onSearchChange).toHaveBeenCalledWith('')
  })

  it('renders the no-conversations empty state without a Clear filters button when filters are inactive', () => {
    renderList({ conversations: [], primaryFilter: 'all', searchQuery: '' })

    expect(screen.getByText(/Nothing here yet/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Clear filters/i })).toBeNull()
  })

  it('renders an empty state when search has no matches and clear filters resets both controls', () => {
    const { onPrimaryFilterChange, onSearchChange } = renderList({
      conversations: [],
      primaryFilter: 'all',
      searchQuery: 'zzz-no-match',
    })

    expect(screen.getByText(/No conversations match/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Clear filters/i }))
    expect(onPrimaryFilterChange).toHaveBeenCalledWith('all')
    expect(onSearchChange).toHaveBeenCalledWith('')
  })
})
