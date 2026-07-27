import { m } from '@/paraglide/messages'
import { z } from 'zod'

const TELEGRAM_BOT_TOKEN_REGEX = /^\d+:[A-Za-z0-9_-]{35,}$/

const NAME_MAX = 80
const NAME_MIN = 2

/**
 * Schemas are built per call rather than held as module constants so validation
 * copy follows the active locale, matching the sign-in, onboarding, and profile
 * forms. Callers memoize on `getLocale()`.
 *
 * Channel names are optional everywhere except the rename dialog: an empty
 * field means "use the platform's own name", which is a valid answer, so the
 * minimum only applies once something has been typed.
 */
function optionalChannelName() {
  return z
    .string()
    .trim()
    .max(NAME_MAX, m.validation_name_max())
    .refine(
      (value) => value.length === 0 || value.length >= NAME_MIN,
      m.validation_name_optional_min(),
    )
}

export function createTelegramChannelSchema() {
  return z.object({
    botToken: z
      .string()
      .trim()
      .regex(TELEGRAM_BOT_TOKEN_REGEX, m.channels_telegram_token_invalid()),
    name: optionalChannelName(),
  })
}

export type TelegramChannelFormValues = z.infer<
  ReturnType<typeof createTelegramChannelSchema>
>

export const telegramChannelDefaultValues: TelegramChannelFormValues = {
  botToken: '',
  name: '',
}

export function createWhatsappChannelSchema() {
  return z.object({ name: optionalChannelName() })
}

export type WhatsappChannelFormValues = z.infer<
  ReturnType<typeof createWhatsappChannelSchema>
>

export const whatsappChannelDefaultValues: WhatsappChannelFormValues = {
  name: '',
}

export function createInstagramChannelSchema() {
  return z.object({ name: optionalChannelName() })
}

export type InstagramChannelFormValues = z.infer<
  ReturnType<typeof createInstagramChannelSchema>
>

export const instagramChannelDefaultValues: InstagramChannelFormValues = {
  name: '',
}

/**
 * Manual WhatsApp connect: credentials pasted from the Meta dashboard
 * (WhatsApp → API Setup) instead of obtained through Embedded Signup.
 */
export function createWhatsappManualChannelSchema() {
  return z.object({
    phoneNumberId: z
      .string()
      .trim()
      .min(1, m.validation_required())
      .regex(/^\d+$/, m.validation_digits_only()),
    accessToken: z.string().trim().min(1, m.validation_required()),
    wabaId: z
      .string()
      .trim()
      .refine(
        (value) => value.length === 0 || /^\d+$/.test(value),
        m.validation_digits_only(),
      ),
    name: optionalChannelName(),
  })
}

export type WhatsappManualChannelFormValues = z.infer<
  ReturnType<typeof createWhatsappManualChannelSchema>
>

export const whatsappManualChannelDefaultValues: WhatsappManualChannelFormValues =
  {
    phoneNumberId: '',
    accessToken: '',
    wabaId: '',
    name: '',
  }

export function createEditChannelNameSchema() {
  return z.object({
    name: z
      .string()
      .trim()
      .min(NAME_MIN, m.validation_name_min())
      .max(NAME_MAX, m.validation_name_max()),
  })
}

export type EditChannelNameFormValues = z.infer<
  ReturnType<typeof createEditChannelNameSchema>
>
