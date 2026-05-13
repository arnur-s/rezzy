import { supabase } from '@/utils/supabase'
import type { ContactWithChannels } from '../types'

const CONTACT_SELECT = `
  id,
  workspace_id,
  name,
  email,
  phone,
  avatar_url,
  status,
  notes,
  created_at,
  updated_at,
  contact_channels(id, channel_type, external_name)
` as const

export async function getContactById(
  contactId: string,
): Promise<ContactWithChannels> {
  const { data, error } = await supabase
    .from('contacts')
    .select(CONTACT_SELECT)
    .eq('id', contactId)
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function updateContactNotes({
  contactId,
  notes,
}: {
  contactId: string
  notes: string
}): Promise<void> {
  const { error } = await supabase
    .from('contacts')
    .update({ notes })
    .eq('id', contactId)

  if (error) {
    throw error
  }
}
