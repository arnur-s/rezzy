import { supabase } from '@/utils/supabase'

export const CHAT_MEDIA_BUCKET = 'chat-media'

export const CHAT_MEDIA_SIGNED_URL_TTL_SEC = 3600

/** TanStack Query cache key for signed chat media URLs. */
export function chatMediaSignedUrlQueryKey(storagePath: string) {
  return ['chat-media-signed-url', storagePath] as const
}

export async function createSignedChatMediaUrl(
  storagePath: string,
  expiresInSeconds: number = CHAT_MEDIA_SIGNED_URL_TTL_SEC,
): Promise<string> {
  const trimmed = storagePath.trim()
  if (!trimmed) {
    throw new Error('Missing storage path')
  }

  const { data, error } = await supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .createSignedUrl(trimmed, expiresInSeconds)

  if (error) {
    throw error
  }
  const url = data.signedUrl
  if (!url) {
    throw new Error('No signed URL returned')
  }
  return url
}
