import { m } from '@/paraglide/messages'
import { isValidPhoneNumber } from 'libphonenumber-js'
import { z } from 'zod'
import { CONTACT_STATUSES } from '@/entities/contact'
import type { ContactWritePayload } from '../api/contacts'

const MAX_NAME = 120
const MAX_EMAIL = 200
const MAX_PHONE = 32

/**
 * Conservative phone check: anything libphonenumber recognises in any region is
 * accepted, so legitimate international formats are not rejected. Matches the
 * approach already used by the account profile form.
 */
function isAcceptablePhone(value: string): boolean {
  return isValidPhoneNumber(value) || isValidPhoneNumber(value, 'RU')
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
 */
export function createContactFormSchema({
  hasChannelIdentity,
}: {
  hasChannelIdentity: boolean
}) {
  const base = z.object({
    name: z.string().trim().max(MAX_NAME, m.contact_form_name_max()),
    phone: z
      .string()
      .trim()
      .max(MAX_PHONE, m.contact_form_phone_max())
      .refine(
        (value) => value === '' || isAcceptablePhone(value),
        m.contact_form_phone_invalid(),
      ),
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
    if (values.name || values.phone || values.email) return
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

/** Form values carry '' for "not filled"; the database wants null. */
export function toContactWritePayload(
  values: ContactFormValues,
): ContactWritePayload {
  return {
    name: values.name || null,
    phone: values.phone || null,
    email: values.email || null,
    status: values.status,
    ownerId: values.ownerId || null,
    tags: values.tags,
  }
}
