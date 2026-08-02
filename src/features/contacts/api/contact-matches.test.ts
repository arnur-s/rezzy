import { postgrestError } from '@/test/supabase-query-mock'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matchWorkspaceContacts } from './contact-matches'
import type { ContactIdentityLookup } from '../model/contact-identity'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('@/utils/supabase', () => ({
  supabase: { rpc: (name: string, args: unknown) => rpc(name, args) },
}))

function lookup(
  overrides: Partial<ContactIdentityLookup> = {},
): ContactIdentityLookup {
  return {
    phoneDigits: [],
    emails: [],
    channelIdentities: [],
    ambiguousPhones: [],
    ...overrides,
  }
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'contact-1',
    name: 'Dana Abisheva',
    phone: '+77011234567',
    email: null,
    avatar_url: null,
    status: 'new',
    match_reason: 'phone',
    ...overrides,
  }
}

beforeEach(() => {
  rpc.mockReset()
  rpc.mockResolvedValue({ data: [], error: null })
})

describe('matchWorkspaceContacts', () => {
  it('does not call the database without an identifier to match on', async () => {
    expect(
      await matchWorkspaceContacts({ workspaceId: 'ws-1', lookup: lookup() }),
    ).toEqual([])
    expect(rpc).not.toHaveBeenCalled()
  })

  it('does not call the database when every number was ambiguous', async () => {
    // A local-format number with no country context is not an identifier: the
    // card reports that it could not check rather than reporting "no match".
    expect(
      await matchWorkspaceContacts({
        workspaceId: 'ws-1',
        lookup: lookup({ ambiguousPhones: ['8 (701) 123-45-67'] }),
      }),
    ).toEqual([])
    expect(rpc).not.toHaveBeenCalled()
  })

  it('matches in the database, scoped to the workspace', async () => {
    rpc.mockResolvedValue({ data: [row()], error: null })

    const matches = await matchWorkspaceContacts({
      workspaceId: 'ws-1',
      lookup: lookup({
        phoneDigits: ['77011234567', '87011234567'],
        emails: ['dana@example.com'],
        channelIdentities: ['whatsapp:77011234567'],
      }),
    })

    expect(rpc).toHaveBeenCalledWith('match_workspace_contacts', {
      p_workspace_id: 'ws-1',
      p_phone_digits: ['77011234567', '87011234567'],
      p_emails: ['dana@example.com'],
      p_identities: ['whatsapp:77011234567'],
      p_limit: 6,
    })
    expect(matches).toEqual([row()])
  })

  it('omits unused facets so the SQL defaults apply', async () => {
    await matchWorkspaceContacts({
      workspaceId: 'ws-1',
      lookup: lookup({ phoneDigits: ['77011234567'] }),
    })

    const [, args] = rpc.mock.calls[0] as [string, Record<string, unknown>]
    expect(args.p_emails).toBeUndefined()
    expect(args.p_identities).toBeUndefined()
  })

  it('surfaces a failed lookup instead of reporting "no match"', async () => {
    rpc.mockResolvedValue({ data: null, error: postgrestError() })

    await expect(
      matchWorkspaceContacts({
        workspaceId: 'ws-1',
        lookup: lookup({ phoneDigits: ['77011234567'] }),
      }),
    ).rejects.toBeTruthy()
  })

  it('rejects a response that is not the agreed shape', async () => {
    // The RPC ships in the same change as this code, so a deployment where one
    // is newer than the other has to fail loudly at the boundary rather than
    // three components later.
    rpc.mockResolvedValue({
      data: [{ id: 'contact-1', match_reason: 'astrology' }],
      error: null,
    })

    await expect(
      matchWorkspaceContacts({
        workspaceId: 'ws-1',
        lookup: lookup({ phoneDigits: ['77011234567'] }),
      }),
    ).rejects.toThrow(/match_workspace_contacts/)
  })
})
