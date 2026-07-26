export const accountQueryKeys = {
  all: ['account'] as const,
  profile: (userId: string) => ['account', 'profile', userId] as const,
  memberships: (userId: string) => ['account', 'memberships', userId] as const,
}
