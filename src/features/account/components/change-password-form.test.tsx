import { setLocale } from '@/paraglide/runtime'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChangePasswordForm } from './change-password-form'

const hoisted = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
  isError: false,
}))

vi.mock('../hooks/use-account-security', () => ({
  useChangePassword: () => ({
    mutate: hoisted.mutate,
    isPending: hoisted.isPending,
    isError: hoisted.isError,
  }),
}))

function passwordField(name: RegExp) {
  return screen.getByLabelText(name)
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: /update password/i }))
}

describe('ChangePasswordForm', () => {
  beforeAll(() => {
    setLocale('en')
  })

  beforeEach(() => {
    hoisted.mutate.mockReset()
    hoisted.isPending = false
    hoisted.isError = false
  })

  it('rejects a password below the minimum length', async () => {
    render(<ChangePasswordForm canChangePassword />)

    fireEvent.change(passwordField(/^New password/), {
      target: { value: 'short' },
    })
    fireEvent.change(passwordField(/Confirm new password/), {
      target: { value: 'short' },
    })
    submit()

    expect(await screen.findByText('Use at least 8 characters')).toBeTruthy()
    expect(hoisted.mutate).not.toHaveBeenCalled()
  })

  it('rejects a confirmation that does not match', async () => {
    render(<ChangePasswordForm canChangePassword />)

    fireEvent.change(passwordField(/^New password/), {
      target: { value: 'correct-horse' },
    })
    fireEvent.change(passwordField(/Confirm new password/), {
      target: { value: 'correct-hors' },
    })
    submit()

    expect(await screen.findByText('Passwords don’t match')).toBeTruthy()
    expect(hoisted.mutate).not.toHaveBeenCalled()
  })

  it('submits a valid password and clears the fields afterwards', async () => {
    hoisted.mutate.mockImplementation((_password, options) => {
      options.onSuccess()
    })

    render(<ChangePasswordForm canChangePassword />)

    fireEvent.change(passwordField(/^New password/), {
      target: { value: 'correct-horse' },
    })
    fireEvent.change(passwordField(/Confirm new password/), {
      target: { value: 'correct-horse' },
    })
    submit()

    await waitFor(() =>
      expect(hoisted.mutate).toHaveBeenCalledWith(
        'correct-horse',
        expect.anything(),
      ),
    )
    expect(await screen.findByText('Password updated')).toBeTruthy()
    // Nothing typed here is worth keeping once it has been sent.
    expect(passwordField(/^New password/)).toHaveProperty('value', '')
    expect(passwordField(/Confirm new password/)).toHaveProperty('value', '')
  })

  it('explains why the form is unavailable without a password identity', () => {
    render(<ChangePasswordForm canChangePassword={false} />)

    // The reason is attached to the field, so Astryx keeps it focusable via
    // aria-disabled and read-only rather than natively disabling it.
    const field = passwordField(/^New password/)
    expect(field.getAttribute('aria-disabled')).toBe('true')
    expect(field).toHaveProperty('readOnly', true)
    expect(
      screen.getAllByText('This account signs in without a password.').length,
    ).toBeGreaterThan(0)
  })

  it('reports a failed change without clearing the fields', () => {
    hoisted.isError = true
    render(<ChangePasswordForm canChangePassword />)

    fireEvent.change(passwordField(/^New password/), {
      target: { value: 'correct-horse' },
    })

    expect(screen.getByText('Couldn’t update your password')).toBeTruthy()
    expect(passwordField(/^New password/)).toHaveProperty(
      'value',
      'correct-horse',
    )
  })
})
