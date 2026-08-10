import type { Tables } from '@/api/types'
import type { LocalePreference } from '@/lib/locale'

export type ProfileRow = Tables<'profiles'>

/**
 * The signed-in user's global account record. Camel-cased and narrowed at the
 * API boundary so nothing above it has to know the column names, and so
 * `language` arrives as the preference union rather than as free text.
 */
export type UserProfile = {
  id: string
  fullName: string
  email: string
  avatarUrl: string | null
  jobTitle: string | null
  phone: string | null
  timezone: string | null
  language: LocalePreference
}

/** The fields the profile form owns. Email is authentication's, not the form's. */
export type ProfileIdentityInput = {
  fullName: string
  jobTitle: string | null
  phone: string | null
  timezone: string | null
}

export const WORKSPACE_ROLES = ['owner', 'admin', 'member'] as const
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number]

export function isWorkspaceRole(value: string): value is WorkspaceRole {
  return (WORKSPACE_ROLES as ReadonlyArray<string>).includes(value)
}

/**
 * One membership as the account area shows it: read-only, and only ever the
 * signed-in user's own — `workspace_members` RLS is `user_id = auth.uid()`.
 */
export type AccountMembership = {
  id: string
  role: string
  joinedAt: string
  workspaceId: string
  workspaceName: string
  workspaceIcon: string | null
}
