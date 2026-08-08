import { attentionQueueQueryKeys } from '@/features/dashboard/api/attention-queue'
import { homeStatsQueryKeys } from '@/features/dashboard/api/home-stats'
import { contactQueryKeys } from '@/features/contacts/api/query-keys'
import {
  useArchiveContact,
  useRestoreContact,
} from '@/features/contacts/hooks/use-contacts'
import { EMPTY_CONTACT_LIST_PARAMS } from '@/features/contacts/model/contact-list-params'
import { inboxQueryKeys } from '@/features/inbox/api/query-keys'
import { createTestQueryClient } from '@/test/render'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Archiving moves rows across surfaces that live in separate caches: the
 * contact leaves the directory, its conversations leave the inbox, and both
 * leave the dashboard's counts.
 *
 * Realtime cannot be leaned on for the conversation half. Supabase evaluates
 * RLS per subscriber, so the archived rows are invisible to the acting admin's
 * own subscription and that client is the one guaranteed NOT to be told. These
 * assertions are what stands between that and an inbox still listing threads
 * the person just hid.
 */

const contactsApi = vi.hoisted(() => ({
  archiveContact: vi.fn(),
  restoreContact: vi.fn(),
}))

vi.mock('@/features/contacts/api/contacts', () => ({
  archiveContact: contactsApi.archiveContact,
  restoreContact: contactsApi.restoreContact,
  createContact: vi.fn(),
  getWorkspaceContact: vi.fn(),
  listArchivedContacts: vi.fn(),
  searchWorkspaceContacts: vi.fn(),
  updateContact: vi.fn(),
}))

vi.mock('@/features/contacts/api/contact-conversations', () => ({
  countContactConversations: vi.fn(),
  listContactConversations: vi.fn(),
}))

vi.mock('@/features/contacts/api/contact-phones', () => ({
  listContactPhones: vi.fn(),
  setContactPhones: vi.fn(),
}))

const WORKSPACE_ID = 'w1'
const CONTACT_ID = 'ct1'

/** Every surface an archive changes, so a partial invalidation cannot pass. */
const AFFECTED_KEYS: Array<QueryKey> = [
  contactQueryKeys.list(WORKSPACE_ID, EMPTY_CONTACT_LIST_PARAMS),
  contactQueryKeys.archivedList(WORKSPACE_ID, '', 1),
  contactQueryKeys.match(WORKSPACE_ID, 'phone:79991234567'),
  inboxQueryKeys.conversations(WORKSPACE_ID),
  inboxQueryKeys.conversationSearch(WORKSPACE_ID, 'anna'),
  inboxQueryKeys.unreadCountsForWorkspace(WORKSPACE_ID),
  homeStatsQueryKeys.forUser('u1', [WORKSPACE_ID]),
  attentionQueueQueryKeys.forUser('u1', [WORKSPACE_ID]),
  attentionQueueQueryKeys.unassigned([WORKSPACE_ID]),
]

function seedAffectedQueries(queryClient: QueryClient) {
  for (const key of AFFECTED_KEYS) {
    queryClient.setQueryData(key, { seeded: true })
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false)
  }
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

describe('useArchiveContact', () => {
  beforeEach(() => {
    contactsApi.archiveContact.mockReset()
    contactsApi.archiveContact.mockResolvedValue(undefined)
    contactsApi.restoreContact.mockReset()
    contactsApi.restoreContact.mockResolvedValue(undefined)
  })

  it('marks the directory, inbox and dashboard stale', async () => {
    const queryClient = createTestQueryClient()
    seedAffectedQueries(queryClient)

    const { result } = renderHook(() => useArchiveContact(WORKSPACE_ID), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate(CONTACT_ID)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    for (const key of AFFECTED_KEYS) {
      expect(
        queryClient.getQueryState(key)?.isInvalidated,
        JSON.stringify(key),
      ).toBe(true)
    }
  })

  it('drops the contact detail rather than refetching it', async () => {
    const queryClient = createTestQueryClient()
    const detailKey = contactQueryKeys.detail(WORKSPACE_ID, CONTACT_ID)
    queryClient.setQueryData(detailKey, { id: CONTACT_ID })

    const { result } = renderHook(() => useArchiveContact(WORKSPACE_ID), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate(CONTACT_ID)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // A refetch would resolve to null under the SELECT policy and render the
    // not-found state on a route that is already navigating away.
    expect(queryClient.getQueryData(detailKey)).toBeUndefined()
  })

  it('passes the contact id straight to the RPC wrapper', async () => {
    const queryClient = createTestQueryClient()
    const { result } = renderHook(() => useArchiveContact(WORKSPACE_ID), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate(CONTACT_ID)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(contactsApi.archiveContact).toHaveBeenCalledWith(CONTACT_ID)
  })
})

describe('useRestoreContact', () => {
  beforeEach(() => {
    contactsApi.restoreContact.mockReset()
    contactsApi.restoreContact.mockResolvedValue(undefined)
  })

  it('marks the same surfaces stale, because restoring changes the same ones', async () => {
    const queryClient = createTestQueryClient()
    seedAffectedQueries(queryClient)

    const { result } = renderHook(() => useRestoreContact(WORKSPACE_ID), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate(CONTACT_ID)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    for (const key of AFFECTED_KEYS) {
      expect(
        queryClient.getQueryState(key)?.isInvalidated,
        JSON.stringify(key),
      ).toBe(true)
    }
  })
})
