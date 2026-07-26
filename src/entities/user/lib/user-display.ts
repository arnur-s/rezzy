import type { User } from '@supabase/supabase-js'

export function getUserDisplayName(user: User, fallback: string) {
  const metadataName =
    getMetadataString(user.user_metadata, 'full_name') ||
    getMetadataString(user.user_metadata, 'name')

  if (metadataName) {
    return metadataName
  }

  return user.email?.split('@').at(0) || fallback
}

/**
 * The name the user typed at sign-up, or '' when auth metadata carries none.
 * Unlike getUserDisplayName this never falls back to the email local part, so
 * it is safe to prefill a "Full name" field with.
 */
export function getUserMetadataFullName(user: User | null) {
  if (!user) {
    return ''
  }

  return (
    getMetadataString(user.user_metadata, 'full_name') ||
    getMetadataString(user.user_metadata, 'name')
  )
}

export function getUserInitials(value: string) {
  const initials = value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()

  return initials || 'U'
}

function getMetadataString(metadata: User['user_metadata'], key: string) {
  const value: unknown = metadata[key]

  return typeof value === 'string' ? value.trim() : ''
}
