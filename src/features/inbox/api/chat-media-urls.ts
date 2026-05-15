import { supabase } from '@/utils/supabase'

export const CHAT_MEDIA_BUCKET = 'chat-media'

export const CHAT_MEDIA_SIGNED_URL_TTL_SEC = 3600

type CreateSignedChatMediaUrlOptions = {
  expiresInSeconds?: number
  workspaceId?: string | null
}

const UUID_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** TanStack Query cache key for signed chat media URLs. */
export function chatMediaSignedUrlQueryKey(storagePath: string) {
  return ['chat-media-signed-url', storagePath] as const
}

function normalizeSignedUrlOptions(
  options: number | CreateSignedChatMediaUrlOptions | undefined,
): Required<Pick<CreateSignedChatMediaUrlOptions, 'expiresInSeconds'>> &
  Pick<CreateSignedChatMediaUrlOptions, 'workspaceId'> {
  if (typeof options === 'number') {
    return { expiresInSeconds: options, workspaceId: null }
  }

  return {
    expiresInSeconds:
      options?.expiresInSeconds ?? CHAT_MEDIA_SIGNED_URL_TTL_SEC,
    workspaceId: options?.workspaceId ?? null,
  }
}

export function validateChatMediaStoragePath(
  storagePath: string,
  workspaceId?: string | null,
): string {
  const trimmed = storagePath.trim()
  if (!trimmed) {
    throw new Error('Missing storage path')
  }

  const segments = trimmed.split('/')
  const hasUnsafeSegment = segments.some(
    (segment) =>
      !segment ||
      segment === '.' ||
      segment === '..' ||
      segment.includes('\\') ||
      segment.includes('?') ||
      segment.includes('#'),
  )
  const isSupportedShape = segments.length === 3 || segments.length === 4
  const workspaceSegment = segments[0]
  const conversationSegment = segments[1]
  const messageSegment = segments.length === 4 ? segments[2] : null

  if (
    trimmed.includes('://') ||
    trimmed.startsWith('/') ||
    hasUnsafeSegment ||
    !isSupportedShape ||
    !UUID_SEGMENT.test(workspaceSegment) ||
    !UUID_SEGMENT.test(conversationSegment) ||
    (messageSegment !== null && !UUID_SEGMENT.test(messageSegment))
  ) {
    throw new Error('Invalid storage path')
  }

  if (
    workspaceId &&
    workspaceSegment.toLowerCase() !== workspaceId.toLowerCase()
  ) {
    throw new Error('Invalid storage path')
  }

  return trimmed
}

export async function createSignedChatMediaUrl(
  storagePath: string,
  options?: number | CreateSignedChatMediaUrlOptions,
): Promise<string> {
  const { expiresInSeconds, workspaceId } = normalizeSignedUrlOptions(options)
  const validatedPath = validateChatMediaStoragePath(storagePath, workspaceId)

  const { data, error } = await supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .createSignedUrl(validatedPath, expiresInSeconds)

  if (error) {
    throw error
  }
  const url = data.signedUrl
  if (!url) {
    throw new Error('No signed URL returned')
  }
  return url
}
