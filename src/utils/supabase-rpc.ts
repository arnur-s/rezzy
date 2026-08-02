import type { PostgrestError } from '@supabase/supabase-js'
import type { z } from 'zod'
import { supabase } from './supabase'

/**
 * Calling a Postgres function that `src/api/types.ts` does not know about yet.
 *
 * `src/api/types.ts` is generated from a live database (`pnpm
 * types:supabase:local` / `:linked`) and must never be hand-edited, so a
 * function introduced by a migration in the same change is invisible to
 * `supabase.rpc`'s typed overloads until someone regenerates against a database
 * that has the migration applied. This module is the one place that bridges that
 * gap, and it is deliberately narrow:
 *
 *   - the untyped call is confined to {@link untypedRpc} — one cast, here, with
 *     `unknown` as its return type rather than `any`, so nothing downstream
 *     inherits a silent escape hatch;
 *   - every caller passes a Zod schema, so the response is *validated* rather
 *     than asserted. That is stronger than the generated types would have been:
 *     a shape mismatch fails loudly at the boundary instead of becoming a
 *     `TypeError` three components later.
 *
 * After the migration is applied and the types are regenerated, callers can move
 * to `supabase.rpc` and this module can go.
 */

type UntypedRpcResult = { data: unknown; error: PostgrestError | null }

type UntypedRpc = (
  name: string,
  args: Record<string, unknown>,
) => PromiseLike<UntypedRpcResult>

const untypedRpc = supabase.rpc as unknown as UntypedRpc

/** True for the PostgREST error raised when the function is not in the schema. */
export function isMissingFunctionError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'PGRST202'
  )
}

export async function callRpc<TSchema extends z.ZodType>(
  name: string,
  args: Record<string, unknown>,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const { data, error } = await untypedRpc(name, args)
  if (error) throw error

  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    // Names the function, because "expected array, received null" three layers
    // up in a query hook says nothing about which call went wrong.
    throw new Error(`Unexpected response shape from ${name}()`)
  }
  return parsed.data
}
