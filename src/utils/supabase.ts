import type { Database } from '@/api/types'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in environment',
  )
}

export function createBrowserSupabaseClient() {
  return createClient<Database>(supabaseUrl, supabaseKey)
}

export const supabase = createBrowserSupabaseClient()
