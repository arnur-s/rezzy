import type { ConversationWithRelations } from '@/entities/conversation'
import { setLocale } from '@/paraglide/runtime'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ContactPanel } from './contact-panel'

const hoisted = vi.hoisted(() => ({
  contactNotesSection: vi.fn(
    (_props: { workspaceId: string; contactId: string }) => null,
  ),
  useContact: vi.fn(),
}))

vi.mock('../../hooks/use-contact', () => ({ useContact: hoisted.useContact }))

vi.mock('@/features/contact-notes', () => ({
  ContactNotesSection: (props: {
    workspaceId: string
    contactId: string
  }) => hoisted.contactNotesSection(props),
}))

// Owns its own query and mutation; this file is about panel composition.
vi.mock('./contact-panel-status-select', () => ({
  ContactPanelStatusSelect: () => null,
}))

const CONVERSATION_AVATAR = 'https://cdn.example.com/from-conversation.png'
const CONTACT_AVATAR = 'https://cdn.example.com/from-contact.png'

function conversation(avatarUrl: string | null): ConversationWithRelations {
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
      avatar_url: avatarUrl,
      status: 'new',
    },
    assigned_profile: null,
  }
}

function renderPanel({
  conversationAvatar = null,
  loadedAvatar,
}: {
  conversationAvatar?: string | null
  loadedAvatar?: string | null
}) {
  hoisted.useContact.mockReturnValue({
    data:
      loadedAvatar === undefined
        ? undefined
        : {
            id: 'contact-1',
            name: 'Jane Doe',
            phone: null,
            avatar_url: loadedAvatar,
            notes: null,
            status: 'new',
            contact_channels: [],
          },
    isPending: loadedAvatar === undefined,
    isError: false,
    isRefetching: false,
    refetch: vi.fn(),
  })

  return render(
    <ContactPanel
      workspaceId="workspace-1"
      conversation={conversation(conversationAvatar)}
      onClose={() => {}}
    />,
  )
}

/**
 * The panel has two sources for the picture and they arrive at different times:
 * the conversation row is already in hand, the contact query lands later. It
 * has to show something immediately and then prefer the fresher value, in the
 * same order it already resolves the name.
 */
describe('ContactPanel', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
    vi.clearAllMocks()
  })

  it('shows the conversation picture before the contact query lands', () => {
    renderPanel({ conversationAvatar: CONVERSATION_AVATAR })

    expect(
      document.querySelector(`img[src="${CONVERSATION_AVATAR}"]`),
    ).not.toBeNull()
  })

  it('prefers the freshly loaded contact picture once it arrives', () => {
    renderPanel({
      conversationAvatar: CONVERSATION_AVATAR,
      loadedAvatar: CONTACT_AVATAR,
    })

    expect(document.querySelector(`img[src="${CONTACT_AVATAR}"]`)).not.toBeNull()
    expect(document.querySelector(`img[src="${CONVERSATION_AVATAR}"]`)).toBeNull()
  })

  it('falls back to initials when neither source has one', () => {
    renderPanel({ conversationAvatar: null, loadedAvatar: null })

    expect(document.querySelector('img')).toBeNull()
  })

  it('scopes Contact Notes to the active workspace and loaded contact', () => {
    renderPanel({ loadedAvatar: null })

    expect(hoisted.contactNotesSection).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      contactId: 'contact-1',
    })
  })
})
