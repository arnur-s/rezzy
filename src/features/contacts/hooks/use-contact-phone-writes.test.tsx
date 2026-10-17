import { renderWithQueryClient } from '@/test/render'
import { postgrestError } from '@/test/supabase-query-mock'
import { act, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContactDetail } from '@/entities/contact'
import type * as ContactPhonesApi from '../api/contact-phones'
import type { ContactWriteInput } from './use-contacts'
import { useCreateContact, useUpdateContact } from './use-contacts'

const api = vi.hoisted(() => ({
  createContact: vi.fn(),
  updateContact: vi.fn(),
  setContactPhones: vi.fn(),
}))

vi.mock('../api/contacts', () => ({
  createContact: api.createContact,
  updateContact: api.updateContact,
  getWorkspaceContact: vi.fn(),
  searchWorkspaceContacts: vi.fn(),
}))

vi.mock('../api/contact-phones', async () => {
  const actual = await vi.importActual<typeof ContactPhonesApi>(
    '../api/contact-phones',
  )
  return { ...actual, setContactPhones: api.setContactPhones }
})

function contactDetail(): ContactDetail {
  return {
    id: 'contact-1',
    workspace_id: 'workspace-1',
    name: 'Dana',
    phone: '+77011234567',
    email: null,
    avatar_url: null,
    status: 'new',
    source: 'manual',
    tags: [],
    owner_id: null,
    last_seen_at: null,
    created_at: '2026-08-03T10:00:00Z',
    updated_at: '2026-08-03T10:00:00Z',
    deleted_at: null,
    merged_into_id: null,
    merged_at: null,
    merged_by: null,
    contact_channels: [],
  }
}

/** Renders a hook and hands back the value it returns on each render. */
function renderHook<T>(useHook: () => T) {
  const box: { current: T | null } = { current: null }
  function Probe() {
    box.current = useHook()
    return null
  }
  renderWithQueryClient(<Probe />)
  return box as { current: T }
}

beforeEach(() => {
  vi.clearAllMocks()
  api.createContact.mockResolvedValue(contactDetail())
  api.updateContact.mockResolvedValue(contactDetail())
  api.setContactPhones.mockResolvedValue([])
})

describe('contact writes with several phone numbers', () => {
  it('saves the contact and whole phone set in one mutation', async () => {
    const hook = renderHook(() => useCreateContact('workspace-1'))

    await act(async () => {
      await hook.current.mutateAsync({
        name: 'Dana',
        phone: '+77011234567',
        email: null,
        status: 'new',
        tags: [],
        ownerId: null,
        phones: ['+77011234567', '+77019998877'],
      } satisfies ContactWriteInput)
    })

    expect(api.createContact).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      payload: {
        name: 'Dana',
        phone: '+77011234567',
        email: null,
        status: 'new',
        tags: [],
        ownerId: null,
      },
      phones: ['+77011234567', '+77019998877'],
    })
    expect(api.setContactPhones).not.toHaveBeenCalled()
  })

  it('leaves the numbers alone when a caller does not manage them', async () => {
    const hook = renderHook(() => useUpdateContact('workspace-1', 'contact-1'))

    await act(async () => {
      await hook.current.mutateAsync({ status: 'done' })
    })

    expect(api.setContactPhones).not.toHaveBeenCalled()
    expect(api.updateContact).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      contactId: 'contact-1',
      patch: { status: 'done' },
      phones: undefined,
    })
  })

  it('surfaces an atomic save failure without issuing a separate phone write', async () => {
    const failure = postgrestError('PHONE_WRITE_FAILED')
    api.createContact.mockRejectedValue(failure)
    const hook = renderHook(() => useCreateContact('workspace-1'))

    await act(async () => {
      await expect(
        hook.current.mutateAsync({
          name: 'Dana',
          phone: '+77011234567',
          email: null,
          status: 'new',
          tags: [],
          ownerId: null,
          phones: ['+77011234567', '+77019998877'],
        }),
      ).rejects.toBe(failure)
    })

    await waitFor(() => expect(hook.current.isError).toBe(true))
    expect(api.createContact).toHaveBeenCalledTimes(1)
    expect(api.setContactPhones).not.toHaveBeenCalled()
  })

  it('submits scalar changes and replacement numbers together when editing', async () => {
    const failure = postgrestError('CONTACT_OWNER_NOT_WORKSPACE_MEMBER')
    api.updateContact.mockRejectedValue(failure)
    const hook = renderHook(() => useUpdateContact('workspace-1', 'contact-1'))

    await act(async () => {
      await expect(
        hook.current.mutateAsync({
          ownerId: 'outside-user',
          phones: ['+77019998877'],
        }),
      ).rejects.toBe(failure)
    })
    expect(api.updateContact).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      contactId: 'contact-1',
      patch: { ownerId: 'outside-user' },
      phones: ['+77019998877'],
    })
    expect(api.setContactPhones).not.toHaveBeenCalled()
  })
})
