export type NotificationTarget = {
  workspaceId: string
  conversationId: string
}

/**
 * Stable thread URL used by both in-app navigation and the service worker.
 * Navigating here switches workspace context and opens the conversation in one
 * step, because the current workspace is derived from the route's `id` param.
 */
export function notificationThreadPath({
  workspaceId,
  conversationId,
}: NotificationTarget): string {
  return `/workspaces/${encodeURIComponent(workspaceId)}/inbox/${encodeURIComponent(conversationId)}`
}

const THREAD_PATH_RE = /^\/workspaces\/([^/]+)\/inbox\/([^/]+)\/?$/

/** Parse a thread URL (absolute or path-only) back into its ids. */
export function parseNotificationThreadPath(
  path: string,
): NotificationTarget | null {
  const pathname = toPathname(path)
  const match = THREAD_PATH_RE.exec(pathname)
  if (!match) return null
  const workspaceId = safeDecode(match[1])
  const conversationId = safeDecode(match[2])
  if (!workspaceId || !conversationId) return null
  return { workspaceId, conversationId }
}

function toPathname(path: string): string {
  try {
    if (/^https?:\/\//i.test(path)) return new URL(path).pathname
  } catch {
    return path
  }
  return path.split('?')[0].split('#')[0]
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
