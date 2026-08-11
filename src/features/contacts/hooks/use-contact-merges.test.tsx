import { attentionQueueQueryKeys } from '@/features/dashboard/api/attention-queue'
import { homeStatsQueryKeys } from '@/features/dashboard/api/home-stats'
import { contactQueryKeys } from '@/features/contacts/api/query-keys'
import { inboxQueryKeys } from '@/features/inbox/api/query-keys'
import { createTestQueryClient } from '@/test/render'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useContactMergeChildren,
  useDuplicateContactGroups,
  useMergeContacts,
} from './use-contact-merges'

/**
 * A merge moves conversations from the merged contact to the survivor, so
 * `onSuccess` is the only substantive logic this file has: get the
 * invalidation set wrong and the inbox keeps showing a thread filed under a
 * contact that no longer exists, or the merged contact's stale detail page
 * renders instead of redirecting.
 */

const mergesApi = vi.hoisted(() => ({
  listDuplicateContactGroups: vi.fn(),
  countContactMergeChildren: vi.fn(),
  mergeContacts: vi.fn(),
}))

vi.mock('../api/contact-merges', () => ({
  listDuplicateContactGroups: mergesApi.listDuplicateContactGroups,
  countContactMergeChildren: mergesApi.countContactMergeChildren,
  mergeContacts: mergesApi.mergeContacts,
}))

const WORKSPACE_ID = 'w1'
const SURVIVOR_ID = 'ct-survivor'
const MERGED_ID = 'ct-merged'

/** Every surface a merge changes, so a partial invalidation cannot pass. */
const AFFECTED_KEYS: Array<QueryKey> = [
  contactQueryKeys.workspace(WORKSPACE_ID),
  inboxQueryKeys.conversations(WORKSPACE_ID),
  inboxQueryKeys.conversationSearchAll(WORKSPACE_ID),
  inboxQueryKeys.unreadCountsForWorkspace(WORKSPACE_ID),
  attentionQueueQueryKeys.all,
  homeStatsQueryKeys.all,
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

describe('useMergeContacts', () => {
  beforeEach(() => {
    mergesApi.mergeContacts.mockReset()
    mergesApi.mergeContacts.mockResolvedValue(undefined)
  })

  it('marks the workspace contact keys and the inbox conversation keys stale', async () => {
    const queryClient = createTestQueryClient()
    seedAffectedQueries(queryClient)

    const { result } = renderHook(() => useMergeContacts(WORKSPACE_ID), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate({
      survivorId: SURVIVOR_ID,
      mergedId: MERGED_ID,
      fields: {},
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    for (const key of AFFECTED_KEYS) {
      expect(
        queryClient.getQueryState(key)?.isInvalidated,
        JSON.stringify(key),
      ).toBe(true)
    }
  })

  it('drops the merged contact detail rather than refetching it', async () => {
    const queryClient = createTestQueryClient()
    const mergedDetailKey = contactQueryKeys.detail(WORKSPACE_ID, MERGED_ID)
    queryClient.setQueryData(mergedDetailKey, { id: MERGED_ID })

    const { result } = renderHook(() => useMergeContacts(WORKSPACE_ID), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate({
      survivorId: SURVIVOR_ID,
      mergedId: MERGED_ID,
      fields: {},
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // A refetch would resolve to null under the SELECT policy (the merged
    // contact no longer exists) and render the not-found state on a route
    // that may still be navigating away from it.
    expect(queryClient.getQueryData(mergedDetailKey)).toBeUndefined()
  })

  it('invalidates rather than drops the survivor detail', async () => {
    const queryClient = createTestQueryClient()
    const survivorDetailKey = contactQueryKeys.detail(
      WORKSPACE_ID,
      SURVIVOR_ID,
    )
    queryClient.setQueryData(survivorDetailKey, { id: SURVIVOR_ID })

    const { result } = renderHook(() => useMergeContacts(WORKSPACE_ID), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate({
      survivorId: SURVIVOR_ID,
      mergedId: MERGED_ID,
      fields: {},
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // The survivor is still visible, so its cache is stale, not gone: the
    // wholesale workspace-prefix invalidation should mark it, not drop it.
    expect(queryClient.getQueryData(survivorDetailKey)).toEqual({
      id: SURVIVOR_ID,
    })
    expect(queryClient.getQueryState(survivorDetailKey)?.isInvalidated).toBe(
      true,
    )
  })

  it('passes the input straight to the RPC wrapper', async () => {
    const queryClient = createTestQueryClient()
    const input = {
      survivorId: SURVIVOR_ID,
      mergedId: MERGED_ID,
      fields: { name: 'Merged Name' },
    }

    const { result } = renderHook(() => useMergeContacts(WORKSPACE_ID), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate(input)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mergesApi.mergeContacts).toHaveBeenCalledWith(input)
  })
})

describe('useDuplicateContactGroups', () => {
  beforeEach(() => {
    mergesApi.listDuplicateContactGroups.mockReset()
    mergesApi.listDuplicateContactGroups.mockResolvedValue({
      items: [],
      totalCount: 0,
    })
  })

  it('does not fetch while disabled', () => {
    const queryClient = createTestQueryClient()
    const { result } = renderHook(
      () =>
        useDuplicateContactGroups({
          workspaceId: WORKSPACE_ID,
          page: 1,
          enabled: false,
        }),
      { wrapper: createWrapper(queryClient) },
    )

    expect(result.current.fetchStatus).toBe('idle')
    expect(mergesApi.listDuplicateContactGroups).not.toHaveBeenCalled()
  })

  it('does not refetch on remount while the data is within staleTime', async () => {
    const queryClient = createTestQueryClient()
    const props = { workspaceId: WORKSPACE_ID, page: 1, enabled: true }

    const first = renderHook(() => useDuplicateContactGroups(props), {
      wrapper: createWrapper(queryClient),
    })
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
    first.unmount()

    // Simulates the duplicates dialog closing and reopening: a second
    // subscriber to the same key within the 60s staleTime must be served
    // from cache, not re-run the workspace-wide group-by.
    const second = renderHook(() => useDuplicateContactGroups(props), {
      wrapper: createWrapper(queryClient),
    })
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true))

    expect(mergesApi.listDuplicateContactGroups).toHaveBeenCalledTimes(1)
  })
})

describe('useContactMergeChildren', () => {
  beforeEach(() => {
    mergesApi.countContactMergeChildren.mockReset()
    mergesApi.countContactMergeChildren.mockResolvedValue({
      conversation_count: 0,
      note_count: 0,
      phone_count: 0,
      channel_count: 0,
    })
  })

  it('does not fetch while the dialog is closed', () => {
    const queryClient = createTestQueryClient()
    const { result } = renderHook(
      () => useContactMergeChildren(WORKSPACE_ID, MERGED_ID, false),
      { wrapper: createWrapper(queryClient) },
    )

    expect(result.current.fetchStatus).toBe('idle')
    expect(mergesApi.countContactMergeChildren).not.toHaveBeenCalled()
  })

  it('fetches once the dialog opens', async () => {
    const queryClient = createTestQueryClient()
    const { result } = renderHook(
      () => useContactMergeChildren(WORKSPACE_ID, MERGED_ID, true),
      { wrapper: createWrapper(queryClient) },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mergesApi.countContactMergeChildren).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      contactId: MERGED_ID,
    })
  })
})
