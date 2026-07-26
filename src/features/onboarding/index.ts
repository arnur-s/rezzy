export { completeOnboarding, OnboardingSessionExpiredError } from './api/onboarding'
export type { OnboardingResult } from './api/onboarding'
export { OnboardingForm } from './components/onboarding-form'
export { OnboardingStatusError } from './components/onboarding-status-error'
export { useCompleteOnboarding } from './hooks/use-complete-onboarding'
export { useOnboardingStatus } from './hooks/use-onboarding-status'
export type { OnboardingStatus } from './hooks/use-onboarding-status'
export {
  resolveAppGate,
  resolveInboxGate,
  resolveOnboardingGate,
} from './lib/onboarding-gate'
export type {
  AppGate,
  InboxGate,
  InboxGateInput,
  OnboardingGate,
  OnboardingGateInput,
} from './lib/onboarding-gate'
export { createOnboardingFormSchema } from './schemas/onboarding-form-schema'
export type { OnboardingFormValues } from './schemas/onboarding-form-schema'
