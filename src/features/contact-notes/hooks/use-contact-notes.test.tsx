import type { ContactNote } from '@/entities/contact-note'
import { createTestQueryClient } from '@/test/render'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { contactNoteQueryKeys } from '../api/query-keys'
import {
  useCreateContactNote,
  useDeleteContactNote,
  useSetContactNotePinned,
  useUpdateContactNote,
} from './use-contact-notes'

const api = vi.hoisted(() => ({
  create: vi.fn(),
  remove: vi.fn(),
  setPinned: vi.fn(),
  update: vi.fn(),
}))

vi.mock('../api/contact-notes', () => ({
  createContactNote: api.create,
  deleteContactNote: api.remove,
  listContactNotes: vi.fn(),
  setContactNotePinned: api.setPinned,
  updateContactNoteBody: api.update,
}))

const scope = { workspaceId: 'workspace-1', contactId: 'contact-1' }
const key = contactNoteQueryKeys.list(scope.workspaceId, scope.contactId)

function note(
  id: string,
  overrides: Partial<ContactNote> = {},
): ContactNote {
  return {
    id,
    workspace_id: scope.workspaceId,
    contact_id: scope.contactId,
    author_id: 'user-1',
    author_name: 'Alex Agent',
    body: `Note ${id}`,
    is_pinned: false,
    created_at: `2026-07-31T10:0${id}:00.000Z`,
    updated_at: `2026-07-31T10:0${id}:00.000Z`,
    ...overrides,
  }
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

function read(queryClient: QueryClient) {
  return queryClient.getQueryData<Array<ContactNote>>(key)
}

describe('contact note mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('adds the created server note to the scoped cache in pinned-first order', async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(key, [note('1')])
    api.create.mockResolvedValue(
      note('2', {
        body: 'Created note',
        is_pinned: true,
        updated_at: '2026-07-31T11:00:00.000Z',
      }),
    )
    const { result } = renderHook(() => useCreateContactNote(scope), {
      wrapper: wrapper(queryClient),
    })

    await act(() => result.current.mutateAsync({ body: 'Created note' }))

    expect(read(queryClient)?.map((item) => item.id)).toEqual(['2', '1'])
    expect(api.create).toHaveBeenCalledWith({ ...scope, body: 'Created note' })
  })

  it('replaces edited content with the returned server row', async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(key, [note('1')])
    api.update.mockResolvedValue(
      note('1', {
        body: 'Updated note',
        updated_at: '2026-07-31T12:00:00.000Z',
      }),
    )
    const { result } = renderHook(() => useUpdateContactNote(scope), {
      wrapper: wrapper(queryClient),
    })

    await act(() =>
      result.current.mutateAsync({ noteId: '1', body: 'Updated note' }),
    )

    expect(read(queryClient)?.[0]?.body).toBe('Updated note')
    expect(api.update).toHaveBeenCalledWith({
      ...scope,
      noteId: '1',
      body: 'Updated note',
    })
  })

  it('optimistically pins a note and moves it ahead of regular notes', async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(key, [note('2'), note('1')])
    api.setPinned.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useSetContactNotePinned(scope), {
      wrapper: wrapper(queryClient),
    })

    act(() => result.current.mutate({ noteId: '1', isPinned: true }))

    await waitFor(() => {
      expect(read(queryClient)?.map((item) => item.id)).toEqual(['1', '2'])
    })
  })

  it('rolls a failed optimistic pin change back to the previous order', async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(key, [note('2'), note('1')])
    api.setPinned.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useSetContactNotePinned(scope), {
      wrapper: wrapper(queryClient),
    })

    act(() => result.current.mutate({ noteId: '1', isPinned: true }))

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
      expect(read(queryClient)?.map((item) => item.id)).toEqual(['2', '1'])
    })
  })

  it('optimistically removes a note and restores it when deletion fails', async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(key, [note('2'), note('1')])
    let rejectDelete: (error: Error) => void = () => {}
    api.remove.mockReturnValue(
      new Promise<void>((_resolve, reject) => {
        rejectDelete = reject
      }),
    )
    const { result } = renderHook(() => useDeleteContactNote(scope), {
      wrapper: wrapper(queryClient),
    })

    act(() => result.current.mutate({ noteId: '2' }))

    await waitFor(() =>
      expect(read(queryClient)?.map((item) => item.id)).toEqual(['1']),
    )

    act(() => rejectDelete(new Error('offline')))

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
      expect(read(queryClient)?.map((item) => item.id)).toEqual(['2', '1'])
    })
  })
})
