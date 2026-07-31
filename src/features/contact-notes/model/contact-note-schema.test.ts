import { setLocale } from '@/paraglide/runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  CONTACT_NOTE_MAX_LENGTH,
  createContactNoteSchema,
} from './contact-note-schema'

describe('createContactNoteSchema', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
  })

  it('rejects empty and whitespace-only notes', () => {
    const schema = createContactNoteSchema()

    expect(schema.safeParse({ body: '' }).success).toBe(false)
    expect(schema.safeParse({ body: '   \n\t ' }).success).toBe(false)
  })

  it('trims surrounding whitespace while preserving internal line breaks', () => {
    expect(
      createContactNoteSchema().parse({ body: '  line one\nline two  ' }),
    ).toEqual({ body: 'line one\nline two' })
  })

  it('rejects notes over the maximum length', () => {
    expect(
      createContactNoteSchema().safeParse({
        body: 'x'.repeat(CONTACT_NOTE_MAX_LENGTH + 1),
      }).success,
    ).toBe(false)
  })
})
