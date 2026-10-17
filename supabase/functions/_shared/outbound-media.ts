/** Service-role signing must never turn a caller-controlled path into cross-workspace access. */
export function isOutboundMediaPath(
  path: string,
  workspaceId: string,
  conversationId: string,
): boolean {
  const segments = path.split('/')
  return (
    (segments.length === 3 || segments.length === 4) &&
    segments[0] === workspaceId &&
    segments[1] === conversationId &&
    segments.every(
      (segment) =>
        segment.length > 0 &&
        segment !== '.' &&
        segment !== '..' &&
        !/[\\\\?#%]/.test(segment),
    )
  )
}
