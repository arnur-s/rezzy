import type { ConversationWithRelations } from '@/entities/conversation'
import type { WorkspaceMember } from '@/entities/workspace'
import { setLocale } from '@/paraglide/runtime'
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConversationListItem } from './conversation-list-item'

vi.mock('@/entities/channel', async () => {
  const actual = await vi.importActual('@/entities/channel')
  return {
    ...actual,
    PlatformIcon: () => <span data-testid="platform-icon" />,
  }
})

function conversation(overrides: {
  id?: string
  unread_count?: number
  contactName?: string
}): ConversationWithRelations {
  const id = overrides.id ?? 'conv-1'
  return {
    id,
    workspace_id: 'w',
    channel_id: 'c',
    contact_id: 'p',
    assigned_to: null,
    status: 'open',
    unread_count: overrides.unread_count ?? 0,
    last_message_at: '2026-05-15T10:00:00Z',
    last_message_preview: 'Hi there',
    snoozed_until: null,
    external_thread_id: null,
    last_inbound_at: null,
    created_at: '2020-01-01',
    updated_at: '2020-01-01',
    deleted_at: null,
    channel: { id: 'c', type: 'telegram', name: null },
    contact: {
      id: 'p',
      name: overrides.contactName ?? 'Test Contact',
      phone: null,
      avatar_url: null,
      status: 'new',
    },
  }
}

const MEMBER: WorkspaceMember = {
  userId: 'user-1',
  role: 'admin',
  fullName: 'Ivan Sidorov',
  avatarUrl: null,
  jobTitle: 'Account manager',
  phone: '+7 916 555-01-22',
  joinedAt: '2020-01-01',
}

function renderInList(
  row: ConversationWithRelations,
  isActive: boolean,
  assignee: WorkspaceMember | null = null,
  isAssigneeUnresolved = false,
) {
  return render(
    <div role="listbox" aria-label="Conversations">
      <button
        type="button"
        role="option"
        aria-selected={isActive}
        aria-label={row.contact.name?.trim() || '—'}
        data-selected={isActive ? 'true' : 'false'}
        className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5"
      >
        <ConversationListItem
          conversation={row}
          isActive={isActive}
          assignee={assignee}
          isAssigneeUnresolved={isAssigneeUnresolved}
        />
      </button>
    </div>,
  )
}

describe('ConversationListItem unread display', () => {
  it('hides unread badge and non-unread typography when active even if unread_count > 0', () => {
    const row = conversation({ unread_count: 4 })
    renderInList(row, true)

    const option = screen.getByRole('option', { name: /Test Contact/i })
    expect(within(option).queryByText('4', { exact: true })).toBeNull()

    const title = within(option).getByText('Test Contact')
    expect(title.className).toContain('font-medium')
    expect(title.className).not.toContain('font-semibold')
  })

  it('shows unread badge and emphasis when inactive and unread_count > 0', () => {
    const row = conversation({ unread_count: 4 })
    renderInList(row, false)

    const option = screen.getByRole('option', { name: /Test Contact/i })
    expect(within(option).getByText('4', { exact: true })).toBeTruthy()

    const title = within(option).getByText('Test Contact')
    expect(title.className).toContain('font-semibold')
  })
})

describe('ConversationListItem assignee mark', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
  })

  it('shows the assignee face when the roster resolves the id', () => {
    renderInList(conversation({}), false, MEMBER)

    const option = screen.getByRole('option', { name: /Test Contact/i })
    // Astryx's Avatar renders its monogram in more than one node; the assertion
    // is that the face is there at all, not how many layers draw it.
    expect(within(option).getAllByText('IS').length).toBeGreaterThan(0)
  })

  it('renders nothing for the mark when nobody is assigned', () => {
    renderInList(conversation({}), false, null)

    const option = screen.getByRole('option', { name: /Test Contact/i })
    expect(within(option).queryAllByText('IS')).toHaveLength(0)
    expect(within(option).queryByLabelText(/former member/i)).toBeNull()
  })

  it('marks an assignee the roster can no longer resolve rather than dropping it', () => {
    renderInList(conversation({}), false, null, true)

    const option = screen.getByRole('option', { name: /Test Contact/i })
    expect(within(option).getByLabelText(/former member/i)).toBeTruthy()
  })
})
