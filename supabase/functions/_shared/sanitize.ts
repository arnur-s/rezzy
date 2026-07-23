// Payload sanitization for durable provider-event storage.
//
// Rule: anything that can authenticate a request must never be persisted —
// tokens, secrets, signatures, authorization material, cookies, raw headers.
// Everything else in the provider payload is kept verbatim so events can be
// audited and reprocessed.

const DENYLISTED_KEY_PATTERNS: readonly RegExp[] = [
  /token/i,
  /secret/i,
  /signature/i,
  /^authorization$/i,
  /^auth$/i,
  /credential/i,
  /password/i,
  /^cookie/i,
  /api[-_]?key/i,
  /^x-hub/i,
  /^headers?$/i,
]

const MAX_STRING_LENGTH = 8_000
const MAX_DEPTH = 12

export function isDenylistedKey(key: string): boolean {
  return DENYLISTED_KEY_PATTERNS.some((pattern) => pattern.test(key))
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

function sanitizeValue(value: unknown, depth: number): JsonValue {
  if (value === null || typeof value === 'boolean') return value as JsonValue
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : String(value)
  }
  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}…[truncated]`
      : value
  }
  if (depth >= MAX_DEPTH) return '[max-depth]'
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1))
  }
  if (typeof value === 'object') {
    const result: { [key: string]: JsonValue } = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (isDenylistedKey(key)) {
        result[key] = '[redacted]'
        continue
      }
      result[key] = sanitizeValue(entry, depth + 1)
    }
    return result
  }
  // functions, symbols, bigint — never expected from JSON.parse
  return String(value)
}

/**
 * Deep-copies a parsed webhook payload, replacing every value whose key matches
 * the credential denylist with '[redacted]' and truncating oversized strings.
 */
export function sanitizeProviderPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return sanitizeValue(payload, 0) as Record<string, unknown>
}

/** Deterministic JSON with sorted object keys, for stable fingerprints. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value ?? null)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
  return `{${entries.join(',')}}`
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input),
  )
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Deterministic fallback fingerprint for events without a natural provider id.
 * Hashes the canonical form of the SANITIZED payload so redelivered duplicates
 * fingerprint identically regardless of key order.
 */
export async function fingerprintFromPayload(
  sanitizedPayload: Record<string, unknown>,
): Promise<string> {
  return `sha256:${await sha256Hex(canonicalJson(sanitizedPayload))}`
}
