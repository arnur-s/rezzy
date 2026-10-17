import type { ContactDetail } from '@/entities/contact'
import { postgrestError } from '@/test/supabase-query-mock'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createContact, updateContact } from './contacts'

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('@/utils/supabase', () => ({ supabase: { rpc, from } }))

const saved: ContactDetail = {
  id: 'contact-1',
  workspace_id: 'workspace-1',
  name: 'Dana',
  phone: '+77011111111',
  email: null,
  avatar_url: null,
  status: 'new',
  source: 'manual',
  tags: [],
  owner_id: null,
  last_seen_at: null,
  created_at: '2026-10-17T10:00:00Z',
  updated_at: '2026-10-17T10:00:00Z',
  deleted_at: null,
  merged_into_id: null,
  merged_at: null,
  merged_by: null,
  contact_channels: [
    {
      id: 'identity-1',
      channel_id: 'channel-1',
      channel_type: 'telegram',
      external_id: '123',
      external_name: 'Dana',
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  rpc.mockResolvedValue({ data: saved, error: null })
})

describe('transactional contact saves', () => {
  it('saves fields and the complete number set in one request and returns the saved detail', async () => {
    const result = await createContact({
      workspaceId: 'workspace-1',
      payload: {
        name: 'Dana',
        phone: '+77011111111',
        email: null,
        status: 'new',
        tags: ['customer'],
        ownerId: 'member-1',
      },
      phones: ['+77011111111', '+77012222222'],
    })
    expect(rpc).toHaveBeenCalledExactlyOnceWith('save_contact', {
      p_workspace_id: 'workspace-1',
      p_contact_id: undefined,
      p_phones: ['+77011111111', '+77012222222'],
      p_fields: {
        name: 'Dana',
        phone: '+77011111111',
        email: null,
        status: 'new',
        tags: ['customer'],
        owner_id: 'member-1',
      },
    })
    expect(result).toEqual(saved)
    expect(from).not.toHaveBeenCalled()
  })

  it('preserves explicit clears while omitting fields the edit did not change', async () => {
    await updateContact({
      workspaceId: 'workspace-1',
      contactId: 'contact-1',
      patch: { email: null, ownerId: null },
      phones: [],
    })
    expect(rpc).toHaveBeenCalledExactlyOnceWith('save_contact', {
      p_workspace_id: 'workspace-1',
      p_contact_id: 'contact-1',
      p_phones: [],
      p_fields: { email: null, owner_id: null },
    })
  })

  it('does not fall back to partial writes when the migration is unavailable', async () => {
    const failure = {
      ...postgrestError('Missing save_contact'),
      code: 'PGRST202',
    }
    rpc.mockResolvedValue({ data: null, error: failure })
    await expect(
      updateContact({
        workspaceId: 'workspace-1',
        contactId: 'contact-1',
        patch: { name: 'Changed' },
        phones: ['+77012222222'],
      }),
    ).rejects.toBe(failure)
    expect(from).not.toHaveBeenCalled()
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})
