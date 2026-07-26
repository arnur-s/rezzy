import { m } from '@/paraglide/messages'
import { z } from 'zod'

// Built per render so validation messages follow the active locale, matching
// the sign-in route. Limits mirror the complete_onboarding RPC, which rejects
// the same values server-side.
export function createOnboardingFormSchema() {
  return z.object({
    fullName: z
      .string()
      .trim()
      .min(1, m.onboarding_full_name_required())
      .max(80, m.onboarding_full_name_max()),
    workspaceName: z
      .string()
      .trim()
      .min(2, m.onboarding_workspace_name_min())
      .max(60, m.onboarding_workspace_name_max()),
  })
}

export type OnboardingFormValues = z.infer<
  ReturnType<typeof createOnboardingFormSchema>
>
