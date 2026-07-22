// Pure, Deno-free helpers for instagram-connect-channel. Kept import-safe so
// Vitest can unit-test them without the edge runtime.

/** Instagram professional account types accepted for messaging (normalized). */
export const PROFESSIONAL_ACCOUNT_TYPES = new Set([
  'BUSINESS',
  'CREATOR',
  'MEDIA_CREATOR',
])

export const REQUIRED_BASIC_SCOPE = 'instagram_business_basic'
export const REQUIRED_MESSAGING_SCOPE = 'instagram_business_manage_messages'

/** Meta returns account_type as title/upper-case constants across surfaces. */
export function normalizeAccountType(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : ''
}

export function isProfessionalAccountType(value: unknown): boolean {
  return PROFESSIONAL_ACCOUNT_TYPES.has(normalizeAccountType(value))
}

/**
 * The short-token exchange may report granted permissions as an array of
 * strings, an array of `{ permission }`/`{ scope }` objects, or a comma/space
 * separated string. Treat all shapes as optional and best-effort.
 */
export function parseGrantedScopes(permissions: unknown): string[] {
  if (Array.isArray(permissions)) {
    return permissions
      .map((entry) => {
        if (typeof entry === 'string') return entry.trim()
        if (entry && typeof entry === 'object') {
          const record = entry as Record<string, unknown>
          const value = record.permission ?? record.scope
          return typeof value === 'string' ? value.trim() : ''
        }
        return ''
      })
      .filter((scope) => scope.length > 0)
  }
  if (typeof permissions === 'string') {
    return permissions
      .split(/[,\s]+/)
      .map((scope) => scope.trim())
      .filter((scope) => scope.length > 0)
  }
  return []
}

export function hasMessagingScope(scopes: string[]): boolean {
  return scopes.includes(REQUIRED_MESSAGING_SCOPE)
}
