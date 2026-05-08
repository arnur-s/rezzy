import { createSlug } from '@/utils/slug'
import { supabase } from '@/utils/supabase'

export type WorkspaceRecord = {
  id: string
  slug: string
}

type WorkspaceInsertError = {
  code?: string
  message: string
}

type WorkspaceInsertResult = {
  data: WorkspaceRecord | null
  error: WorkspaceInsertError | null
}

export type WorkspaceClient = {
  from: (table: 'workspaces') => {
    insert: (values: {
      created_by: string
      name: string
      slug: string
    }) => {
      select: (columns: 'id, slug') => {
        single: () => PromiseLike<WorkspaceInsertResult>
      }
    }
  }
}

export async function createWorkspaceWithUniqueSlug(
  name: string,
  userId: string,
  client: WorkspaceClient = supabase,
): Promise<WorkspaceRecord> {
  const baseSlug = createSlug(name)
  let lastSlugError: unknown

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`
    const { data, error } = await client
      .from('workspaces')
      .insert({
        created_by: userId,
        name,
        slug,
      })
      .select('id, slug')
      .single()

    if (!error && data) {
      return data
    }

    if (error?.code === '23505') {
      lastSlugError = error
      continue
    }

    throw error
  }

  throw lastSlugError instanceof Error
    ? lastSlugError
    : new Error('Could not create a unique workspace URL.')
}
