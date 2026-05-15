import { useQuery } from '@tanstack/react-query'
import {
  CHAT_MEDIA_SIGNED_URL_TTL_SEC,
  chatMediaSignedUrlQueryKey,
  createSignedChatMediaUrl,
} from '../api/chat-media-urls'

const STALE_MS = 50 * 60 * 1000

/**
 * Resolves a time-limited signed URL for an object in the private `chat-media` bucket.
 */
export function useMessageMediaUrl(
  storagePath: string | null | undefined,
  workspaceId?: string | null,
) {
  const path = storagePath?.trim() ?? ''
  const enabled = path.length > 0

  return useQuery({
    queryKey: chatMediaSignedUrlQueryKey(path),
    queryFn: () => createSignedChatMediaUrl(path, { workspaceId }),
    enabled,
    staleTime: STALE_MS,
    gcTime: (CHAT_MEDIA_SIGNED_URL_TTL_SEC + 600) * 1000,
  })
}
