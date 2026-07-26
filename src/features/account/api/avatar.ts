import { supabase } from '@/utils/supabase'

export const AVATAR_BUCKET = 'avatars'

/** Mirrors the bucket's own file_size_limit, so the client fails first. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024

export const ACCEPTED_AVATAR_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const

/** The `accept` attribute for the file picker. */
export const AVATAR_ACCEPT = ACCEPTED_AVATAR_MIME_TYPES.join(',')

export type AvatarRejection = 'type' | 'size'

export function validateAvatarFile(file: File): AvatarRejection | null {
  if (
    !(ACCEPTED_AVATAR_MIME_TYPES as ReadonlyArray<string>).includes(file.type)
  ) {
    return 'type'
  }

  if (file.size > MAX_AVATAR_BYTES) return 'size'

  return null
}

export class AvatarValidationError extends Error {
  constructor(readonly rejection: AvatarRejection) {
    super(`AVATAR_REJECTED_${rejection.toUpperCase()}`)
    this.name = 'AvatarValidationError'
  }
}

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

/**
 * Storage policies authorize on the first path segment, so every object has to
 * live under a folder named for its owner. The timestamp keeps a replacement
 * from being served from a cached URL.
 */
function buildAvatarPath(userId: string, file: File) {
  const extension = EXTENSIONS[file.type] ?? 'png'
  return `${userId}/avatar-${Date.now()}.${extension}`
}

/**
 * The object path inside the bucket, or `null` when the URL points somewhere
 * else. Used to clean up the previous object; anything unrecognized is left
 * alone rather than guessed at.
 */
export function avatarPathFromUrl(url: string): string | null {
  const marker = `/${AVATAR_BUCKET}/`
  const index = url.indexOf(marker)
  if (index === -1) return null

  const path = url.slice(index + marker.length).split('?')[0]

  return path.length > 0 ? decodeURIComponent(path) : null
}

export async function uploadAvatar({
  userId,
  file,
}: {
  userId: string
  file: File
}): Promise<string> {
  const rejection = validateAvatarFile(file)
  if (rejection) throw new AvatarValidationError(rejection)

  const path = buildAvatarPath(userId, file)

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) throw error

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)

  return data.publicUrl
}

/**
 * Best-effort: the profile row is the source of truth, so a stale object left
 * behind is cheaper than failing a save the user already saw succeed.
 */
export async function removeAvatarObject(url: string | null): Promise<void> {
  if (!url) return

  const path = avatarPathFromUrl(url)
  if (!path) return

  await supabase.storage.from(AVATAR_BUCKET).remove([path])
}
