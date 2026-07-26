import { m } from '@/paraglide/messages'
import { z } from 'zod'

/** Matches the minimum the sign-in form already enforces. */
export const MIN_PASSWORD_LENGTH = 8

export function createPasswordFormSchema() {
  return z
    .object({
      password: z
        .string()
        .min(MIN_PASSWORD_LENGTH, m.security_password_min())
        .max(72, m.security_password_max()),
      confirmPassword: z.string(),
    })
    .refine((values) => values.password === values.confirmPassword, {
      // Reported on the confirmation field: that is the one the user can fix
      // without retyping the password they meant.
      path: ['confirmPassword'],
      message: m.security_password_mismatch(),
    })
}

export type PasswordFormValues = z.infer<
  ReturnType<typeof createPasswordFormSchema>
>
