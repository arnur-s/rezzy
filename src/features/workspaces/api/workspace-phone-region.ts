import { callRpc } from '@/utils/supabase-rpc'
import { z } from 'zod'

/**
 * The country a phone number written WITHOUT a `+` belongs to, for this
 * workspace.
 *
 * Null means unknown, and unknown stays unknown: a product used by teams in
 * different countries must not read `701 123 45 67` as Kazakh because the
 * codebase happened to pick that fallback. Callers treat an unplaceable number
 * as ambiguous and decline to match on it — see `src/lib/phone-identity.ts`.
 *
 * Read and written through RPCs rather than the table, because
 * `workspaces.default_phone_region` ships in the same change as the migration
 * and `src/api/types.ts` cannot be regenerated until that migration is applied.
 */
export const workspacePhoneRegionQueryKeys = {
  detail: (workspaceId: string) =>
    ['workspaces', 'phone-region', workspaceId] as const,
}

const regionSchema = z
  .string()
  .regex(/^[A-Z]{2}$/)
  .nullable()

export async function getWorkspacePhoneRegion(
  workspaceId: string,
): Promise<string | null> {
  return callRpc(
    'get_workspace_phone_region',
    { p_workspace_id: workspaceId },
    regionSchema,
  )
}

export async function setWorkspacePhoneRegion({
  workspaceId,
  region,
}: {
  workspaceId: string
  /** ISO 3166-1 alpha-2, or null to clear. */
  region: string | null
}): Promise<string | null> {
  return callRpc(
    'set_workspace_phone_region',
    { p_workspace_id: workspaceId, p_region: region },
    regionSchema,
  )
}
