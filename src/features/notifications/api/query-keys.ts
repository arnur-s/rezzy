export const notificationQueryKeys = {
  all: ['notifications'] as const,
  preferences: (userId: string) =>
    ['notifications', 'preferences', userId] as const,
}
