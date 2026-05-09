import { supabase } from '@/utils/supabase'

export async function getAuthUser() {
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    throw error
  }

  return data.user
}
