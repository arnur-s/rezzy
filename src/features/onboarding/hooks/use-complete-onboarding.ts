import { workspaceQueryKeys } from '@/features/workspaces/api/workspaces'
import { supabase } from '@/utils/supabase'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { completeOnboarding } from '../api/onboarding'
import type { OnboardingFormValues } from '../schemas/onboarding-form-schema'

export function useCompleteOnboarding() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: OnboardingFormValues) => {
      const result = await completeOnboarding(values)

      // The header greets the user from auth metadata rather than from the
      // profile row, so keep the two in step. This is a display cache, not one
      // of the records onboarding must create: failing here must not undo a
      // successful setup, so the error is swallowed deliberately.
      const { error } = await supabase.auth.updateUser({
        data: { full_name: values.fullName.trim() },
      })

      if (error) {
        console.error('Unable to sync the display name to auth metadata', error)
      }

      return result
    },
    onSuccess: async () => {
      // Prefix-invalidates the workspace list, detail and members queries, so
      // the onboarding gate sees the new workspace before we navigate.
      await queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.all,
      })
    },
  })
}
