import { z } from 'zod'

const TELEGRAM_BOT_TOKEN_REGEX = /^\d+:[A-Za-z0-9_-]{35,}$/

export const telegramChannelSchema = z.object({
  botToken: z
    .string()
    .trim()
    .regex(
      TELEGRAM_BOT_TOKEN_REGEX,
      'Token must look like 123456:ABCDEF1234567890abcdef1234567890ABC.',
    ),
  name: z
    .string()
    .trim()
    .max(80, 'Keep the channel name under 80 characters.')
    .refine(
      (value) => value.length === 0 || value.length >= 2,
      'If you enter a name, use at least 2 characters.',
    ),
})

export type TelegramChannelFormValues = z.infer<typeof telegramChannelSchema>

export const telegramChannelDefaultValues: TelegramChannelFormValues = {
  botToken: '',
  name: '',
}

export const whatsappChannelSchema = z.object({
  name: z
    .string()
    .trim()
    .max(80, 'Keep the channel name under 80 characters.')
    .refine(
      (value) => value.length === 0 || value.length >= 2,
      'If you enter a name, use at least 2 characters.',
    ),
})

export type WhatsappChannelFormValues = z.infer<typeof whatsappChannelSchema>

export const whatsappChannelDefaultValues: WhatsappChannelFormValues = {
  name: '',
}

/**
 * Manual WhatsApp connect: credentials pasted from the Meta dashboard
 * (WhatsApp → API Setup) instead of obtained through Embedded Signup.
 */
export const whatsappManualChannelSchema = z.object({
  phoneNumberId: z
    .string()
    .trim()
    .min(1, 'Phone number ID is required.')
    .regex(/^\d+$/, 'Phone number ID should contain digits only.'),
  accessToken: z.string().trim().min(1, 'Access token is required.'),
  wabaId: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || /^\d+$/.test(value),
      'WhatsApp Business Account ID should contain digits only.',
    ),
  name: z
    .string()
    .trim()
    .max(80, 'Keep the channel name under 80 characters.')
    .refine(
      (value) => value.length === 0 || value.length >= 2,
      'If you enter a name, use at least 2 characters.',
    ),
})

export type WhatsappManualChannelFormValues = z.infer<
  typeof whatsappManualChannelSchema
>

export const whatsappManualChannelDefaultValues: WhatsappManualChannelFormValues =
  {
    phoneNumberId: '',
    accessToken: '',
    wabaId: '',
    name: '',
  }

export const editChannelNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Channel name must be at least 2 characters.')
    .max(80, 'Keep the channel name under 80 characters.'),
})

export type EditChannelNameFormValues = z.infer<typeof editChannelNameSchema>
