import type { ContactDetail } from '@/entities/contact'
import { setLocale } from '@/paraglide/runtime'
import { renderWithQueryClient } from '@/test/render'
import { waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ContactDetailPage } from './contact-detail-page'

const navigate = vi.hoisted(() => vi.fn())
const showToast = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    useNavigate: () => navigate,
    Link: ({
      children,
      className,
    }: {
      children: React.ReactNode
      className?: string
    }) => (
      <a href="#contact" className={className}>
        {children}
      </a>
    ),
  }
})

vi.mock('@astryxdesign/core/Toast', () => ({
  useToast: () => showToast,
}))

vi.mock('@/features/workspaces/hooks/use-workspaces', () => ({
  useIsWorkspaceAdmin: () => ({ isAdmin: false, isLoaded: true }),
  useWorkspaceMemberDirectory: () => ({ data: [] }),
}))

const contactDetailQuery = vi.hoisted(() => ({
  data: undefined as ContactDetail | undefined,
  isPending: false,
  isError: false,
  isRefetching: false,
  refetch: vi.fn(),
}))

vi.mock('../hooks/use-contacts', () => ({
  useContactDetail: () => contactDetailQuery,
  useContactConversations: () => ({ data: [] }),
  useContactPhones: () => ({ data: [] }),
}))

// This suite is only about the redirect effect at the top of the page, not
// about the full detail view or its dialogs — those pull in auth, member
// directory and form-schema machinery the redirect does not touch.
vi.mock('@/features/contact-notes', () => ({
  ContactNotesSection: () => null,
}))

vi.mock('./archive-contact-dialog', () => ({
  ArchiveContactDialog: () => null,
}))

vi.mock('./contact-form-dialog', () => ({
  ContactFormDialog: () => null,
}))

function contact(overrides: Partial<ContactDetail> = {}): ContactDetail {
  return {
    id: 'contact-1',
    workspace_id: 'ws-1',
    name: 'Jamie Rivera',
    phone: null,
    email: null,
    avatar_url: null,
    status: 'new',
    source: null,
    tags: [],
    owner_id: null,
    last_seen_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    merged_into_id: null,
    merged_at: null,
    merged_by: null,
    contact_channels: [],
    ...overrides,
  }
}

function renderPage() {
  return renderWithQueryClient(
    <ContactDetailPage workspaceId="ws-1" contactId="contact-1" />,
  )
}

describe('ContactDetailPage merged redirect', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
    vi.clearAllMocks()
    contactDetailQuery.data = undefined
    contactDetailQuery.isPending = false
    contactDetailQuery.isError = false
  })

  it('does not redirect an ordinary, unmerged contact', async () => {
    contactDetailQuery.data = contact()

    renderPage()

    // Give any stray effect a tick to fire before asserting its absence.
    await waitFor(() => expect(contactDetailQuery.data).not.toBeUndefined())
    expect(navigate).not.toHaveBeenCalled()
    expect(showToast).not.toHaveBeenCalled()
  })

  it('redirects to the survivor with replace, and toasts, when merged_into_id is set', async () => {
    contactDetailQuery.data = contact({ merged_into_id: 'contact-2' })

    renderPage()

    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1))
    expect(navigate).toHaveBeenCalledWith({
      to: '/workspaces/$id/contacts/$contactId',
      params: { id: 'ws-1', contactId: 'contact-2' },
      replace: true,
    })
    expect(showToast).toHaveBeenCalledWith({
      body: 'This contact was merged into another one',
      type: 'info',
    })
  })
})
