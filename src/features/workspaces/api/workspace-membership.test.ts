import { describe, expect, it } from 'vitest'
import { membershipErrorMessage } from './workspace-membership'
import { m } from '@/paraglide/messages'

describe('membershipErrorMessage', () => {
  it('maps every RPC token to its own localized string', () => {
    expect(membershipErrorMessage({ message: 'USER_NOT_FOUND' })).toBe(
      m.workspace_settings_members_invite_error_user_not_found(),
    )
    expect(membershipErrorMessage({ message: 'ALREADY_A_MEMBER' })).toBe(
      m.workspace_settings_members_invite_error_already_member(),
    )
    expect(membershipErrorMessage({ message: 'LAST_OWNER' })).toBe(
      m.workspace_settings_members_error_last_owner(),
    )
    expect(
      membershipErrorMessage({ message: 'OWNER_ROLE_REQUIRES_OWNER' }),
    ).toBe(m.workspace_settings_members_error_owner_only())
  })

  it('falls back to a localized generic message, never to raw English', () => {
    expect(membershipErrorMessage({ message: 'some_pg_internal_detail' })).toBe(
      m.workspace_settings_members_error_generic(),
    )
    expect(membershipErrorMessage(null)).toBe(
      m.workspace_settings_members_error_generic(),
    )
  })
})
