import { AsYouType, parsePhoneNumberFromString } from 'libphonenumber-js'

/**
 * Phone numbers are stored in E.164 (`+77765218213`) and shown grouped
 * (`+7 776 521 82 13`).
 *
 * The field is international-only, on purpose. A domestic string like
 * `8 777 521 82 13` is ambiguous without knowing the writer's country, and this
 * is a multi-workspace product whose members are not necessarily co-located —
 * guessing the country from the UI locale would silently mis-store the numbers
 * of everyone it guessed wrong about. Requiring the `+` prefix costs one
 * character and makes every stored number dialable from anywhere.
 */

/**
 * Formats as the user types, without ever fighting the caret: `AsYouType`
 * only ever appends separators, so the text grows left-to-right.
 *
 * Input that has not yet reached a recognisable country code is returned as
 * typed — mid-entry strings are not errors, they are incomplete.
 */
export function formatPhoneAsYouType(input: string): string {
  const trimmed = input.trimStart()
  if (trimmed === '') return ''

  // Anything that is not a leading `+` or a digit-ish separator can't be a
  // phone number in progress; hand it back so validation can report it rather
  // than having the formatter silently swallow the characters.
  if (!/^[+\d]/.test(trimmed)) return input

  const formatted = new AsYouType().input(trimmed)
  return formatted === '' ? trimmed : formatted
}

/** True when the value is a complete, dialable international number. */
export function isValidPhone(value: string): boolean {
  const parsed = parsePhoneNumberFromString(value)
  return parsed?.isValid() ?? false
}

/**
 * E.164 for storage, or `null` when the value is empty.
 *
 * Returns the trimmed input unchanged when it cannot be parsed. The schema
 * rejects those before they reach here; keeping the raw value rather than
 * dropping it means a validation gap shows up as a badly formatted number
 * rather than as silent data loss.
 */
export function toE164(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed === '') return null

  return parsePhoneNumberFromString(trimmed)?.number ?? trimmed
}

/** E.164 from storage back to the grouped form the field displays. */
export function fromE164(value: string | null): string {
  if (!value) return ''

  const parsed = parsePhoneNumberFromString(value)
  return parsed?.formatInternational() ?? value
}
