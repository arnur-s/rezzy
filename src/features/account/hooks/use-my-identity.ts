import { getUserDisplayName, getUserInitials } from '@/entities/user'
import { m } from '@/paraglide/messages'
import { useAuth } from '@/providers/auth-provider'
import { useMyProfile } from './use-my-profile'

/**
 * Who the signed-in user is, as anything outside the account area should show
 * them: the name they saved and the picture they uploaded.
 *
 * This exists because there are two sources of identity and only one of them is
 * editable. Auth metadata is written once at sign-up and never again — change
 * your name on the profile page and `user_metadata.full_name` still holds
 * whatever you typed when you registered, and it carries no avatar at all. So
 * every surface that read the auth user directly showed a name the user had
 * already corrected and initials where their photo should be.
 *
 * The profile row wins, and auth metadata is the fallback for the window before
 * the query settles and for the rare account whose row predates the sign-up
 * trigger. Both are unauthenticated-safe: signed out, this is all nulls.
 */
export type MyIdentity = {
  /** Never empty when signed in — falls back to the email local part. */
  displayName: string
  /** Uploaded picture, or `undefined` so `Avatar` renders initials instead. */
  avatarUrl: string | undefined
  initials: string
  email: string
  /** True while the profile row that carries the saved name is still loading. */
  isLoading: boolean
}

export function useMyIdentity(): MyIdentity {
  const { user } = useAuth()
  const profileQuery = useMyProfile()
  const profile = profileQuery.data

  // The saved name, then auth metadata, then the email local part.
  //
  // Trimmed because a row seeded from a blank sign-up field holds '' rather
  // than null, and an empty string has to fall through rather than render as a
  // nameless row. Read through `trimmed` rather than as `profile.fullName
  // .trim()` because this is the identity every screen depends on: the column
  // is typed non-null, but a partial row reaching the cache would otherwise
  // take the whole app down, and a fallback name is a far better failure than
  // a blank page.
  const displayName =
    trimmed(profile?.fullName) ||
    (user ? getUserDisplayName(user, m.sidebar_unknown_user()) : '')

  return {
    displayName,
    avatarUrl: profile?.avatarUrl ?? undefined,
    initials: getUserInitials(displayName),
    email: trimmed(profile?.email) || user?.email || '',
    isLoading: Boolean(user) && profileQuery.isPending,
  }
}

/** Trims anything, including the values the types promise cannot arrive. */
function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
