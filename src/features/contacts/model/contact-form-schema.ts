import { m } from '@/paraglide/messages'
import { isValidPhoneNumber } from 'libphonenumber-js'
import type { CountryCode } from 'libphonenumber-js'
import { z } from 'zod'
import { CONTACT_STATUSES } from '@/entities/contact'
import type { ContactWritePayload } from '../api/contacts'
import { MAX_CONTACT_PHONES } from '../api/contact-phones'

const MAX_NAME = 120
const MAX_EMAIL = 200
const MAX_PHONE = 32

/**
 * Conservative phone check: anything libphonenumber recognises internationally
 * is accepted, so legitimate formats are never rejected. A local-format number
 * is accepted only when a region can be named for it — the workspace's, when it
 * has one. Without that, a number written without a country code cannot be
 * stored as a dialable number, and asking for the `+` is better than guessing a
 * country and matching the wrong person later.
 */
function isAcceptablePhone(value: string, region: CountryCode | null): boolean {
  if (isValidPhoneNumber(value)) return true
  return region ? isValidPhoneNumber(value, region) : false
}

/**
 * The contact form's validation.
 *
 * A factory, not a module constant, because Zod reads its messages when the
 * schema is *constructed*: a module-level schema would freeze whichever locale
 * happened to be active on first import. Call it through `useLocalizedSchema`.
 *
 * `hasChannelIdentity` is what keeps channel-only contacts editable. Most
 * contacts here are created by an inbound message and have no name, phone or
 * email at all — they are identified solely by the handle on the channel they
 * wrote from. A flat "require one of name/phone/email" rule would make every one
 * of them unsaveable: opening the form just to set a status or an owner would
 * fail validation on fields the user never filled and does not need. So identity
 * counts channel identity too, and the cross-field rule only applies when there
 * is no channel to fall back on.
 *
 * `region` is the workspace's default phone region (null when it has none); see
 * {@link isAcceptablePhone}.
 */
export function createContactFormSchema({
  hasChannelIdentity,
  region = null,
}: {
  hasChannelIdentity: boolean
  region?: CountryCode | null
}) {
  const base = z.object({
    name: z.string().trim().max(MAX_NAME, m.contact_form_name_max()),
    /**
     * Every number the contact can be reached on, primary first. An array of
     * objects rather than of strings because React Hook Form's field array keys
     * rows by a generated id, and a string array cannot carry one.
     */
    phones: z
      .array(
        z.object({
          value: z
            .string()
            .trim()
            .max(MAX_PHONE, m.contact_form_phone_max())
            .refine(
              (value) => value === '' || isAcceptablePhone(value, region),
              m.contact_form_phone_invalid(),
            ),
        }),
      )
      .max(MAX_CONTACT_PHONES, m.contact_form_phones_max()),
    email: z
      .string()
      .trim()
      .max(MAX_EMAIL, m.contact_form_email_max())
      .refine(
        (value) => value === '' || z.email().safeParse(value).success,
        m.contact_form_email_invalid(),
      ),
    status: z.enum(CONTACT_STATUSES),
    ownerId: z.string(),
    tags: z.array(z.string().trim().min(1)),
  })

  if (hasChannelIdentity) return base

  return base.superRefine((values, ctx) => {
    if (values.name || filledPhones(values.phones).length > 0 || values.email) {
      return
    }
    // Attached to a field rather than the form root so a screen reader announces
    // it with a labelled control instead of as a stray alert.
    ctx.addIssue({
      code: 'custom',
      path: ['name'],
      message: m.contact_form_identity_required(),
    })
  })
}

export type ContactFormValues = z.infer<
  ReturnType<typeof createContactFormSchema>
>

/** The rows the user actually filled in, in order; blank rows are not numbers. */
export function filledPhones(
  phones: ContactFormValues['phones'],
): Array<string> {
  return phones.map((entry) => entry.value.trim()).filter((value) => value !== '')
}

/** Form values carry '' for "not filled"; the database wants null. */
export function toContactWritePayload(
  values: ContactFormValues,
): ContactWritePayload {
  return {
    name: values.name || null,
    // The primary number, which is what `contacts.phone` means. The full set is
    // written alongside it by `setContactPhones`.
    phone: filledPhones(values.phones)[0] ?? null,
    email: values.email || null,
    status: values.status,
    ownerId: values.ownerId || null,
    tags: values.tags,
  }
}
