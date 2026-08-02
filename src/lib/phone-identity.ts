import { isSupportedCountry, parsePhoneNumberFromString } from 'libphonenumber-js'
import type { CountryCode } from 'libphonenumber-js'

/**
 * Phone identity: deciding whether two written phone numbers are the same
 * number, tolerating the formats people and providers actually use.
 *
 *   +7 701 123 45 67   international, spaced
 *   +77011234567       E.164
 *   8 (701) 123-45-67  domestic, trunk prefix
 *
 * Two numbers are the same when their *digit* forms agree after expanding each
 * into the representations libphonenumber derives for it — E.164 and the
 * country's own national form. There is no "compare the last N digits" rule:
 * that equates a Kazakh mobile with an American landline ending the same way,
 * and this is a multi-workspace product where that would merge two people.
 *
 * A number written without a country code has no meaning on its own, so the
 * country is *resolved*, never assumed:
 *
 *   1. an explicit country code on the number itself
 *   2. a region implied by the payload it arrived with — a sibling number on the
 *      same contact card, or the channel the conversation runs on
 *   3. the workspace's configured default region
 *   4. nothing → the number is AMBIGUOUS and is not matched on at all
 *
 * Step 4 is the important one. Defaulting to one country would quietly claim
 * that `701 123 45 67` in a Brazilian workspace is a Kazakh number, and the
 * consequence is not a missed match but a wrong one: opening someone else's
 * record, or suppressing a create because a stranger looked like a duplicate.
 */

/** Shortest input worth treating as a phone number rather than a fragment. */
const MIN_SIGNIFICANT_DIGITS = 5

/** Where the country used to read a number came from. */
export type PhoneRegionSource = 'explicit' | 'payload' | 'workspace' | 'none'

export type PhoneRegionContext = {
  /**
   * Regions implied by the payload the number arrived in, strongest first — a
   * sibling number that does carry a country code, or the channel's own region.
   */
  hints?: ReadonlyArray<string | null | undefined>
  /** The workspace's configured default region, when it has one. */
  workspaceRegion?: string | null
}

export type PhoneIdentity =
  | {
      status: 'known'
      /** Digit strings any of which, if stored, means this number. */
      digits: Array<string>
      region: CountryCode | null
      source: PhoneRegionSource
    }
  /** A local-format number with no country context. Never matched on. */
  | { status: 'ambiguous'; digits: [] }

const EMPTY_CONTEXT: PhoneRegionContext = {}

/** Every digit of `value`, with `+`, spaces, brackets and dashes removed. */
export function phoneDigits(value: string): string {
  return value.replace(/\D/g, '')
}

function toCountryCode(value: string | null | undefined): CountryCode | null {
  if (!value) return null
  const upper = value.trim().toUpperCase()
  // `isSupportedCountry` is libphonenumber's own type guard, so the narrowing
  // is its, not ours.
  return isSupportedCountry(upper) ? upper : null
}

/**
 * The region a number states about itself, or null when it does not state one.
 * This is what makes a sibling number on the same card usable as context.
 */
export function regionFromExplicitNumber(
  value: string | null | undefined,
): CountryCode | null {
  const trimmed = value?.trim()
  if (!trimmed?.startsWith('+')) return null
  const parsed = parsePhoneNumberFromString(trimmed)
  return parsed?.isValid() ? (parsed.country ?? null) : null
}

function expand(parsed: {
  number: string
  formatNational: () => string
}): Array<string> {
  return [
    ...new Set([phoneDigits(parsed.number), phoneDigits(parsed.formatNational())]),
  ]
}

/**
 * Reads one written number under the country hierarchy above.
 *
 * The returned digits are what a lookup compares against `phone_digits(...)` in
 * the database. An ambiguous number carries none: the caller must skip it rather
 * than fall back to comparing raw digits, because two countries' local numbers
 * can be spelled identically.
 */
export function phoneIdentity(
  value: string,
  context: PhoneRegionContext = EMPTY_CONTEXT,
): PhoneIdentity {
  const trimmed = value.trim()
  if (phoneDigits(trimmed).length < MIN_SIGNIFICANT_DIGITS) {
    return { status: 'ambiguous', digits: [] }
  }

  if (trimmed.startsWith('+')) {
    const parsed = parsePhoneNumberFromString(trimmed)
    if (parsed?.isValid()) {
      return {
        status: 'known',
        digits: expand(parsed),
        region: parsed.country ?? null,
        source: 'explicit',
      }
    }
    // A `+` that libphonenumber cannot place is still an international number:
    // its digits are self-contained, so they are compared literally rather than
    // reinterpreted under some other country.
    return {
      status: 'known',
      digits: [phoneDigits(trimmed)],
      region: null,
      source: 'explicit',
    }
  }

  const tiers: Array<{ region: CountryCode | null; source: PhoneRegionSource }> = [
    ...(context.hints ?? []).map((hint) => ({
      region: toCountryCode(hint),
      source: 'payload' as const,
    })),
    { region: toCountryCode(context.workspaceRegion), source: 'workspace' as const },
  ]

  for (const tier of tiers) {
    if (!tier.region) continue
    const parsed = parsePhoneNumberFromString(trimmed, tier.region)
    if (parsed?.isValid()) {
      return {
        status: 'known',
        digits: expand(parsed),
        region: parsed.country ?? tier.region,
        source: tier.source,
      }
    }
  }

  return { status: 'ambiguous', digits: [] }
}

/** The digits a lookup should search for; empty when the number is ambiguous. */
export function phoneLookupDigits(
  value: string,
  context: PhoneRegionContext = EMPTY_CONTEXT,
): Array<string> {
  return phoneIdentity(value, context).digits
}

/**
 * Whether two written numbers denote the same number.
 *
 * For collapsing spellings *within one payload* — a WhatsApp card carrying the
 * same subscriber as a written number and as a wa_id — and for display. It falls
 * back to literal digit equality when neither side can be placed, which is safe
 * between two strings that arrived together and is NOT safe across records;
 * cross-record identity goes through {@link phoneLookupDigits}, which refuses to
 * guess.
 */
export function phoneNumbersMatch(
  a: string,
  b: string,
  context: PhoneRegionContext = EMPTY_CONTEXT,
): boolean {
  const left = phoneIdentity(a, context)
  const right = phoneIdentity(b, context)

  if (left.status === 'known' && right.status === 'known') {
    const rightDigits = new Set(right.digits)
    return left.digits.some((candidate) => rightDigits.has(candidate))
  }

  const leftDigits = phoneDigits(a)
  if (leftDigits.length < MIN_SIGNIFICANT_DIGITS) return false
  return leftDigits === phoneDigits(b)
}

function parseUnder(
  trimmed: string,
  identity: PhoneIdentity,
): ReturnType<typeof parsePhoneNumberFromString> {
  if (identity.status !== 'known') return undefined
  if (trimmed.startsWith('+')) return parsePhoneNumberFromString(trimmed)
  return identity.region
    ? parsePhoneNumberFromString(trimmed, identity.region)
    : undefined
}

/** E.164 when the number can be placed, otherwise the value as written. */
export function formatPhoneForStorage(
  value: string,
  context: PhoneRegionContext = EMPTY_CONTEXT,
): string {
  const trimmed = value.trim()
  return parseUnder(trimmed, phoneIdentity(trimmed, context))?.number ?? trimmed
}

/** Grouped international form for display, or the value as written. */
export function formatPhoneForDisplay(
  value: string,
  context: PhoneRegionContext = EMPTY_CONTEXT,
): string {
  const trimmed = value.trim()
  return (
    parseUnder(trimmed, phoneIdentity(trimmed, context))?.formatInternational() ??
    trimmed
  )
}
