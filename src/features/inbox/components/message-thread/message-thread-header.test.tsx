import type { ConversationWithRelations } from '@/entities/conversation'
import { setLocale } from '@/paraglide/runtime'
import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { MessageThreadHeader } from './message-thread-header'

// The status actions own their own queries and routing; this file is about what
// the header shows, not what those buttons do.
vi.mock('./message-thread-status-actions', () => ({
  MessageThreadStatusActions: () => null,
}))

const AVATAR = 'https://cdn.example.com/contact.png'

function conversation(
  overrides: Partial<ConversationWithRelations['contact']> = {},
): ConversationWithRelations {
  return {
    id: 'conv-1',
    workspace_id: 'workspace-1',
    channel_id: 'channel-1',
    contact_id: 'contact-1',
    assigned_to: null,
    status: 'open',
    unread_count: 0,
    last_message_at: '2026-05-15T10:00:00Z',
    last_message_preview: 'Hi there',
    snoozed_until: null,
    external_thread_id: null,
    last_inbound_at: null,
    created_at: '2026-05-01T10:00:00Z',
    updated_at: '2026-05-01T10:00:00Z',
    channel: { id: 'channel-1', type: 'telegram', name: null },
    contact: {
      id: 'contact-1',
      name: 'Jane Doe',
      phone: null,
      avatar_url: null,
      status: 'new',
      ...overrides,
    },
    assigned_profile: null,
  }
}

function renderHeader(contact: Partial<ConversationWithRelations['contact']>) {
  return render(
    <MessageThreadHeader
      conversation={conversation(contact)}
      workspaceId="workspace-1"
      onToggleContactPanel={() => {}}
    />,
  )
}

/**
 * Contacts have carried an `avatar_url` all along, and the conversation query
 * has always selected it, but the header rendered initials over the top of it.
 * These pin that the stored picture is actually used, and that a contact
 * without one still gets a monogram rather than an empty circle.
 */
describe('MessageThreadHeader avatar', () => {
  beforeAll(() => {
    setLocale('en', { reload: false })
  })

  it('shows the contact picture the conversation already carries', () => {
    renderHeader({ avatar_url: AVATAR })

    expect(document.querySelector(`img[src="${AVATAR}"]`)).not.toBeNull()
  })

  it('falls back to initials when the contact has no picture', () => {
    renderHeader({ avatar_url: null })

    expect(document.querySelector('img')).toBeNull()
    expect(screen.getAllByText('JD').length).toBeGreaterThan(0)
  })
})
