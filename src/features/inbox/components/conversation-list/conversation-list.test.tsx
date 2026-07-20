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
