import { m } from '@/paraglide/messages'
import { z } from 'zod'
import type { ProfileIdentityInput } from '../model/types'

/** Digits with the punctuation people actually type around them. */
const PHONE_SHAPE = /^[+(\d][\d\s().-]*$/

function isPlausiblePhone(value: string) {
  if (!PHONE_SHAPE.test(value)) return false
  return (value.match(/\d/g)?.length ?? 0) >= 3
}

// Built per render so validation messages follow the active locale, matching
// the sign-in route and the onboarding form. Lengths mirror the column
// constraints added in 20260726150000_account_profile_fields.
//
// Optional fields stay plain trimmed strings rather than being nullable here:
// an empty input means "not set", which is a valid state, not a validation
// error. `toProfileIdentityInput` is what turns it into `null` for storage.
export function createProfileFormSchema() {
  return z.object({
    fullName: z
      .string()
      .trim()
      .min(1, m.profile_full_name_required())
      .max(80, m.profile_full_name_max()),
    jobTitle: z.string().trim().max(80, m.profile_job_title_max()),
    phone: z
      .string()
      .trim()
      .max(32, m.profile_phone_max())
      .refine((value) => value === '' || isPlausiblePhone(value), {
        message: m.profile_phone_invalid(),
      }),
    timezone: z.string().trim().max(64, m.profile_timezone_max()),
  })
}

export type ProfileFormValues = z.infer<
  ReturnType<typeof createProfileFormSchema>
>

function orNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function toProfileIdentityInput(
  values: ProfileFormValues,
): ProfileIdentityInput {
  return {
    fullName: values.fullName.trim(),
    jobTitle: orNull(values.jobTitle),
    phone: orNull(values.phone),
    timezone: orNull(values.timezone),
  }
}
