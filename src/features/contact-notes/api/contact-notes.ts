import type { ContactNote } from '@/entities/contact-note'
import { sortContactNotes } from '@/entities/contact-note'
import { supabase } from '@/utils/supabase'

export type ContactNotesScope = {
  workspaceId: string
  contactId: string
}

export async function listContactNotes({
  workspaceId,
  contactId,
}: ContactNotesScope): Promise<ContactNote[]> {
  const { data, error } = await supabase
    .from('contact_notes')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('contact_id', contactId)
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  if (error) throw error

  return sortContactNotes(data)
}

export async function createContactNote({
  workspaceId,
  contactId,
  body,
}: ContactNotesScope & { body: string }): Promise<ContactNote> {
  const { data, error } = await supabase
    .from('contact_notes')
    .insert({
      workspace_id: workspaceId,
      contact_id: contactId,
      body,
    })
    .select('*')
    .single()

  if (error) throw error

  return data
}

export async function updateContactNoteBody({
  workspaceId,
  contactId,
  noteId,
  body,
}: ContactNotesScope & { noteId: string; body: string }): Promise<ContactNote> {
  const { data, error } = await supabase
    .from('contact_notes')
    .update({ body })
    .eq('id', noteId)
    .eq('workspace_id', workspaceId)
    .eq('contact_id', contactId)
    .select('*')
    .single()

  if (error) throw error

  return data
}

export async function setContactNotePinned({
  workspaceId,
  contactId,
  noteId,
  isPinned,
}: ContactNotesScope & {
  noteId: string
  isPinned: boolean
}): Promise<ContactNote> {
  const { data, error } = await supabase
    .from('contact_notes')
    .update({ is_pinned: isPinned })
    .eq('id', noteId)
    .eq('workspace_id', workspaceId)
    .eq('contact_id', contactId)
    .select('*')
    .single()

  if (error) throw error

  return data
}

export async function deleteContactNote({
  workspaceId,
  contactId,
  noteId,
}: ContactNotesScope & { noteId: string }): Promise<void> {
  const { error } = await supabase
    .from('contact_notes')
    .delete()
    .eq('id', noteId)
    .eq('workspace_id', workspaceId)
    .eq('contact_id', contactId)

  if (error) throw error
}
