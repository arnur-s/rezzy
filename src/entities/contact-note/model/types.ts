import type { Tables, TablesInsert, TablesUpdate } from '@/api/types'

export type ContactNote = Tables<'contact_notes'>
export type ContactNoteInsert = TablesInsert<'contact_notes'>
export type ContactNoteUpdate = TablesUpdate<'contact_notes'>
