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

/** The error PostgREST returns for a function that is not in the schema. */
function missingFunction() {
  return { ...postgrestError('Could not find the function'), code: 'PGRST202' }
}

beforeEach(() => {
  vi.clearAllMocks()
  api.createContact.mockResolvedValue(contactDetail())
  api.updateContact.mockResolvedValue(contactDetail())
  api.setContactPhones.mockResolvedValue([])
})

describe('contact writes with several phone numbers', () => {
  it('writes the whole set after creating the contact', async () => {
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

    expect(api.setContactPhones).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      contactId: 'contact-1',
      phones: ['+77011234567', '+77019998877'],
    })
  })

  it('leaves the numbers alone when a caller does not manage them', async () => {
    const hook = renderHook(() => useUpdateContact('workspace-1', 'contact-1'))

    await act(async () => {
      await hook.current.mutateAsync({ status: 'done' })
    })

    expect(api.setContactPhones).not.toHaveBeenCalled()
  })

  it('still saves a single number when the phones RPC is not deployed yet', async () => {
    // Between deploying this code and applying its migration the function does
    // not exist. One number lives in contacts.phone regardless, so the save
    // must not fail — and must not leave the user staring at an error for a
    // contact that was in fact created.
    api.setContactPhones.mockRejectedValue(missingFunction())
    const hook = renderHook(() => useCreateContact('workspace-1'))

    await act(async () => {
      await hook.current.mutateAsync({
        name: 'Dana',
        phone: '+77011234567',
        email: null,
        status: 'new',
        tags: [],
        ownerId: null,
        phones: ['+77011234567'],
      })
    })

    await waitFor(() => expect(hook.current.isSuccess).toBe(true))
  })

  it('reports a failure when a set the column cannot hold is lost', async () => {
    api.setContactPhones.mockRejectedValue(missingFunction())
    const hook = renderHook(() => useCreateContact('workspace-1'))

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
    ).rejects.toBeTruthy()
  })
})
