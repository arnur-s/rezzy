import { workspaceQueryKeys } from '@/features/workspaces/api/workspaces'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { completeOnboarding } from '../api/onboarding'
import type { OnboardingFormValues } from '../schemas/onboarding-form-schema'

export function useCompleteOnboarding() {
  const queryClient = useQueryClient()

  return useMutation({
    // No auth metadata sync: sign-up already wrote full_name, and the RPC reads
    // the display name from there rather than from anything typed here.
    mutationFn: (values: OnboardingFormValues) => completeOnboarding(values),
    onSuccess: async () => {
      // Prefix-invalidates the workspace list, detail and members queries, so
      // the onboarding gate sees the new workspace before we navigate.
      await queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.all,
      })
    },
  })
}
