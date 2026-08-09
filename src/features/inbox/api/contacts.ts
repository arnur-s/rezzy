import type { ContactWithChannels } from '@/entities/contact'
import { supabase } from '@/utils/supabase'

const CONTACT_SELECT = `
  id,
  workspace_id,
  name,
  email,
  phone,
  avatar_url,
  status,
  owner_id,
  last_seen_at,
  source,
  tags,
  created_at,
  updated_at,
  deleted_at,
  merged_into_id,
  merged_at,
  merged_by,
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
