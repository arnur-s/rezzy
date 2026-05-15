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
