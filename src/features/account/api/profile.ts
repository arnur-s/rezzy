import type { TablesInsert, TablesUpdate } from '@/api/types'
import { isLocalePreference } from '@/lib/locale'
import type { LocalePreference } from '@/lib/locale'
import { supabase } from '@/utils/supabase'
import type {
  AccountMembership,
  ProfileIdentityInput,
  ProfileRow,
  UserProfile,
} from '../model/types'

const PROFILE_SELECT =
  'id, full_name, email, avatar_url, job_title, phone, timezone, language' as const

type ProfileSelection = Pick<
  ProfileRow,
  | 'id'
  | 'full_name'
  | 'email'
  | 'avatar_url'
  | 'job_title'
  | 'phone'
  | 'timezone'
  | 'language'
>

export function rowToProfile(row: ProfileSelection): UserProfile {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    avatarUrl: row.avatar_url,
    jobTitle: row.job_title,
    phone: row.phone,
    timezone: row.timezone,
    // A check constraint keeps the column to the three preferences, but the
    // generated type is `string`, so an unexpected value falls back rather than
    // widening LocalePreference.
    language: isLocalePreference(row.language) ? row.language : 'auto',
  }
}

/**
 * `null` when the row is missing. A `handle_new_user` trigger creates it at
 * sign-up, so this only happens for accounts that predate the trigger — the
 * mutations below seed it on first write.
 */
export async function getMyProfile(
  userId: string,
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return rowToProfile(data)
}

/**
 * Patch the caller's own row, seeding it when RLS returns no row to update.
 * A patch rather than an upsert so a mutation only ever writes the columns it
 * owns — a language change must not carry a stale name back to the server.
 */
async function patchMyProfile(
  userId: string,
  patch: TablesUpdate<'profiles'>,
  seed: () => TablesInsert<'profiles'>,
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select(PROFILE_SELECT)
    .maybeSingle()

  if (error) throw error
  if (data) return rowToProfile(data)

  const { data: inserted, error: insertError } = await supabase
    .from('profiles')
    .insert(seed())
    .select(PROFILE_SELECT)
    .single()

  if (insertError) throw insertError

  return rowToProfile(inserted)
}

export async function updateMyProfileIdentity({
  userId,
  email,
  values,
}: {
  userId: string
  email: string
  values: ProfileIdentityInput
}): Promise<UserProfile> {
  const patch: TablesUpdate<'profiles'> = {
    full_name: values.fullName,
    job_title: values.jobTitle,
    phone: values.phone,
    timezone: values.timezone,
  }

  return patchMyProfile(userId, patch, () => ({
    ...patch,
    id: userId,
    email,
    full_name: values.fullName,
  }))
}

export async function updateMyAvatarUrl({
  userId,
  email,
  fullName,
  avatarUrl,
}: {
  userId: string
  email: string
  fullName: string
  avatarUrl: string | null
}): Promise<UserProfile> {
  return patchMyProfile(userId, { avatar_url: avatarUrl }, () => ({
    id: userId,
    email,
    full_name: fullName,
    avatar_url: avatarUrl,
  }))
}

export async function updateMyLanguage({
  userId,
  email,
  fullName,
  language,
}: {
  userId: string
  email: string
  fullName: string
  language: LocalePreference
}): Promise<UserProfile> {
  return patchMyProfile(userId, { language }, () => ({
    id: userId,
    email,
    full_name: fullName,
    language,
  }))
}

type MembershipSelection = {
  id: string
  role: string
  created_at: string
  workspace: {
    id: string
    name: string
    icon: string | null
  } | null
}

/**
 * The caller's own memberships. `workspace_members` RLS is
 * `user_id = auth.uid()`, so this can never return anyone else's — the account
 * area shows it read-only for exactly that reason.
 */
export async function getMyWorkspaceMemberships(
  userId: string,
): Promise<Array<AccountMembership>> {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('id, role, created_at, workspace:workspaces(id, name, icon)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw error

  const rows = data as unknown as Array<MembershipSelection>

  return rows
    .filter((row): row is MembershipSelection & {
      workspace: NonNullable<MembershipSelection['workspace']>
    } => row.workspace !== null)
    .map((row) => ({
      id: row.id,
      role: row.role,
      joinedAt: row.created_at,
      workspaceId: row.workspace.id,
      workspaceName: row.workspace.name,
      workspaceIcon: row.workspace.icon,
    }))
}
