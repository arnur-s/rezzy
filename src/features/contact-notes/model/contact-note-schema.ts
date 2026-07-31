import { m } from '@/paraglide/messages'
import { z } from 'zod'

export const CONTACT_NOTE_MAX_LENGTH = 5000

export function createContactNoteSchema() {
  return z.object({
    body: z
      .string()
      .trim()
      .min(1, m.contact_notes_validation_required())
      .max(
        CONTACT_NOTE_MAX_LENGTH,
        m.contact_notes_validation_max({ max: CONTACT_NOTE_MAX_LENGTH }),
      ),
  })
}

export type ContactNoteFormValues = z.infer<
  ReturnType<typeof createContactNoteSchema>
>
