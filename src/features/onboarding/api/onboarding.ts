import { supabase } from '@/utils/supabase'
import type { OnboardingFormValues } from '../schemas/onboarding-form-schema'

export type OnboardingResult = {
  /** False when onboarding had already completed and the existing workspace was returned. */
  isNew: boolean
  workspaceId: string
}

/** SQLSTATE the RPC raises when auth.uid() is null (missing or expired session). */
const UNAUTHENTICATED_ERROR_CODE = '28000'

export class OnboardingSessionExpiredError extends Error {
  constructor() {
    super('The Supabase session expired before onboarding could complete.')
    this.name = 'OnboardingSessionExpiredError'
  }
}

/**
 * Creates the profile, workspace and owner membership in one transaction.
 *
 * The RPC derives the user from auth.uid(), so no user id is sent from the
 * browser, and repeated calls return the existing workspace instead of creating
 * a second one.
 */
export async function completeOnboarding({
  fullName,
  workspaceName,
}: OnboardingFormValues): Promise<OnboardingResult> {
  const { data, error } = await supabase.rpc('complete_onboarding', {
    p_full_name: fullName.trim(),
    p_workspace_name: workspaceName.trim(),
  })

  if (error) {
    if (error.code === UNAUTHENTICATED_ERROR_CODE) {
      throw new OnboardingSessionExpiredError()
    }

    throw error
  }

  const result = data.at(0)

  if (!result) {
    throw new Error('complete_onboarding returned no workspace.')
  }

  return { isNew: result.is_new, workspaceId: result.workspace_id }
}
