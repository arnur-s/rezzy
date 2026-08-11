import { m } from '@/paraglide/messages'
import { z } from 'zod'

/**
 * The roles an invitation may carry, mirroring the
 * `workspace_invitations_role_check` constraint (20260809150000). `owner` is
 * absent on purpose: ownership is granted by a role change on somebody already
 * on the roster, never handed out at the door.
 *
 * The invite form's role options are derived from this, so the two cannot drift.
 */
export const INVITE_MEMBER_ROLES = ['admin', 'member'] as const

/**
 * Built per call rather than held as a module constant so validation copy
 * follows the active locale, matching the other forms. Callers memoize on
 * `getLocale()` via `useLocalizedSchema`.
 *
 * The email is trimmed before it is validated because a pasted address usually
 * arrives with whitespace, and `invite_workspace_member` matches
 * `public.profiles.email` exactly — an untrimmed address resolves to
 * USER_NOT_FOUND for a user who is in fact registered.
 */
export function createInviteMemberSchema() {
  return z.object({
    email: z.string().trim().pipe(z.email(m.auth_sign_in_email_invalid())),
    role: z.enum(INVITE_MEMBER_ROLES),
  })
}

export type InviteMemberFormValues = z.infer<
  ReturnType<typeof createInviteMemberSchema>
>

export const inviteMemberDefaultValues: InviteMemberFormValues = {
  email: '',
  role: 'member',
}
