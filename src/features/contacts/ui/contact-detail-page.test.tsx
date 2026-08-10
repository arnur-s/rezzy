import type { ContactDetail } from '@/entities/contact'
import { setLocale } from '@/paraglide/runtime'
import { renderWithQueryClient } from '@/test/render'
import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as UseContactsModule from '../hooks/use-contacts'
import { ContactDetailPage } from './contact-detail-page'

const navigate = vi.hoisted(() => vi.fn())
const showToast = vi.hoisted(() => vi.fn())

// Only the two RPC-backed calls the redirect actually depends on are mocked.
// `useContactDetail` and `useResolveMergedContact` run for real, on top of
// these, so the tests exercise the real gating — `resolveMergedContact` is
// asked only once `getWorkspaceContact` has come back null — rather than a
// data shape (`merged_into_id` present on a *found* contact) that RLS makes
// impossible: the contacts SELECT policy hides a merged row from every
// caller, so `getWorkspaceContact` can never return one.
const api = vi.hoisted(() => ({
  getWorkspaceContact: vi.fn(),
  resolveMergedContact: vi.fn(),
}))

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

vi.mock('../api/contacts', () => ({
  getWorkspaceContact: api.getWorkspaceContact,
  resolveMergedContact: api.resolveMergedContact,
}))

// Unrelated to the redirect; stubbed so the page's other queries don't need a
// real API behind them. useContactDetail and useResolveMergedContact are
// deliberately left real (see the comment on `api` above).
vi.mock('../hooks/use-contacts', async () => {
  const actual = await vi.importActual<typeof UseContactsModule>(
    '../hooks/use-contacts',
  )
  return {
    ...actual,
    useContactConversations: () => ({ data: [] }),
    useContactPhones: () => ({ data: [] }),
  }
})

// This suite is only about the redirect at the top of the page, not about the
// full detail view or its dialogs — those pull in auth, member directory and
// form-schema machinery the redirect does not touch.
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
  })

  it('never asks resolve_merged_contact for a contact the ordinary lookup already found', async () => {
    api.getWorkspaceContact.mockResolvedValue(contact())

    renderPage()

    expect(await screen.findByText('Jamie Rivera')).not.toBeNull()
    expect(api.resolveMergedContact).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
    expect(showToast).not.toHaveBeenCalled()
  })

  it('renders not-found and does not redirect when the id resolves to nothing at all', async () => {
    api.getWorkspaceContact.mockResolvedValue(null)
    api.resolveMergedContact.mockResolvedValue(null)

    renderPage()

    await waitFor(() =>
      expect(api.resolveMergedContact).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        contactId: 'contact-1',
      }),
    )
    expect(await screen.findByText('Contact not found')).not.toBeNull()
    expect(navigate).not.toHaveBeenCalled()
    expect(showToast).not.toHaveBeenCalled()
  })

  it('redirects to the survivor with replace, and toasts, once resolve_merged_contact names one', async () => {
    api.getWorkspaceContact.mockResolvedValue(null)
    api.resolveMergedContact.mockResolvedValue('contact-2')

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
