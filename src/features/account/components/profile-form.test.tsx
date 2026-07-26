import { setLocale } from '@/paraglide/runtime'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserProfile } from '../model/types'
import { ProfileForm } from './profile-form'

const hoisted = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
  isError: false,
}))

vi.mock('../hooks/use-my-profile', () => ({
  useUpdateMyProfile: () => ({
    mutate: hoisted.mutate,
    isPending: hoisted.isPending,
    isError: hoisted.isError,
  }),
}))

const PROFILE: UserProfile = {
  id: 'user-1',
  fullName: 'Ada Lovelace',
  email: 'ada@example.com',
  avatarUrl: null,
  jobTitle: 'Account manager',
  phone: '+1 555 0100',
  timezone: 'Europe/Berlin',
  language: 'auto',
}

function field(name: string) {
  return screen.getByRole('textbox', { name: new RegExp(name, 'i') })
}

function saveButton() {
  return screen.getByRole('button', { name: /save changes/i })
}

/**
 * Save carries a tooltip explaining why it is unavailable, and Astryx switches
 * to aria-disabled in that case so the reason stays reachable by keyboard.
 */
function isSaveDisabled() {
  return saveButton().getAttribute('aria-disabled') === 'true'
}

describe('ProfileForm', () => {
  beforeAll(() => {
    setLocale('en')
  })

  beforeEach(() => {
    hoisted.mutate.mockReset()
    hoisted.isPending = false
    hoisted.isError = false
  })

  it('opens with the values from the profile', () => {
    render(<ProfileForm profile={PROFILE} />)

    expect(field('Full name')).toHaveProperty('value', 'Ada Lovelace')
    expect(field('Job title')).toHaveProperty('value', 'Account manager')
    expect(field('Phone number')).toHaveProperty('value', '+1 555 0100')
  })

  it('leaves optional fields empty rather than filling them in', () => {
    render(
      <ProfileForm
        profile={{ ...PROFILE, jobTitle: null, phone: null, timezone: null }}
      />,
    )

    expect(field('Job title')).toHaveProperty('value', '')
    expect(field('Phone number')).toHaveProperty('value', '')
  })

  it('disables saving until something changes', () => {
    render(<ProfileForm profile={PROFILE} />)

    expect(isSaveDisabled()).toBe(true)

    fireEvent.change(field('Full name'), { target: { value: 'Ada L.' } })

    expect(isSaveDisabled()).toBe(false)
  })

  it('rejects an empty full name', async () => {
    render(<ProfileForm profile={PROFILE} />)

    fireEvent.change(field('Full name'), { target: { value: '   ' } })
    fireEvent.click(saveButton())

    expect(await screen.findByText('Enter your full name')).toBeTruthy()
    expect(hoisted.mutate).not.toHaveBeenCalled()
  })

  it('rejects a phone number that is not a phone number', async () => {
    render(<ProfileForm profile={PROFILE} />)

    fireEvent.change(field('Phone number'), { target: { value: 'call me' } })
    fireEvent.click(saveButton())

    expect(await screen.findByText('Enter a valid phone number')).toBeTruthy()
    expect(hoisted.mutate).not.toHaveBeenCalled()
  })

  it('trims values and sends cleared optional fields as null', async () => {
    render(<ProfileForm profile={PROFILE} />)

    fireEvent.change(field('Full name'), { target: { value: '  Ada L.  ' } })
    fireEvent.change(field('Job title'), { target: { value: '' } })
    fireEvent.click(saveButton())

    await waitFor(() => expect(hoisted.mutate).toHaveBeenCalledTimes(1))
    expect(hoisted.mutate.mock.calls[0][0]).toEqual({
      fullName: 'Ada L.',
      jobTitle: null,
      phone: '+1 555 0100',
      timezone: 'Europe/Berlin',
    })
  })

  it('confirms a successful save and disables the button again', async () => {
    hoisted.mutate.mockImplementation((values, options) => {
      options.onSuccess({ ...PROFILE, fullName: values.fullName })
    })

    render(<ProfileForm profile={PROFILE} />)

    fireEvent.change(field('Full name'), { target: { value: 'Ada L.' } })
    fireEvent.click(saveButton())

    expect(await screen.findByText('Changes saved')).toBeTruthy()
    await waitFor(() => expect(isSaveDisabled()).toBe(true))
  })

  it('keeps the typed values and explains a failed save', () => {
    hoisted.isError = true

    render(<ProfileForm profile={PROFILE} />)

    fireEvent.change(field('Full name'), { target: { value: 'Ada L.' } })

    expect(screen.getByText('Couldn’t save your changes')).toBeTruthy()
    expect(field('Full name')).toHaveProperty('value', 'Ada L.')
    // Still submittable — a failed save is a retryable one.
    expect(isSaveDisabled()).toBe(false)
  })
})
