import { setLocale } from '@/paraglide/runtime'
import { render } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { formatTimeZoneLabel, getBrowserTimeZone } from '../lib/time-zones'
import type { UserProfile } from '../model/types'
import { ProfileForm } from './profile-form'

vi.mock('../hooks/use-my-profile', () => ({
  useUpdateMyProfile: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
  }),
}))

const PROFILE: UserProfile = {
  id: 'user-1',
  fullName: 'Ada Lovelace',
  email: 'ada@example.com',
  avatarUrl: null,
  jobTitle: null,
  phone: null,
  timezone: null,
  language: 'auto',
}

/**
 * The zone field is optional and most accounts never fill it, so it usually
 * opens blank. "Times in your conversations are shown in this zone." pointing
 * at an empty control is true and useless: it names no zone, and the reader has
 * no way to tell what their timestamps are actually being rendered in.
 *
 * Asserted against whatever zone the machine running the tests reports, rather
 * than a pinned string: the component reads it through a module-scope import,
 * and a test that only holds on one developer's laptop is worse than none.
 */
describe('ProfileForm time zone description', () => {
  beforeAll(() => {
    setLocale('en')
  })

  it('names the device zone in effect while the field is empty', () => {
    const browserZone = getBrowserTimeZone()
    expect(browserZone, 'the test runtime reports no zone').toBeTruthy()

    const { container } = render(
      <ProfileForm profile={{ ...PROFILE, timezone: null }} />,
    )

    expect(container.textContent).toContain(
      formatTimeZoneLabel(browserZone as string),
    )
  })

  it('drops the fallback note once the account has chosen a zone', () => {
    const { container } = render(
      <ProfileForm profile={{ ...PROFILE, timezone: 'Europe/Berlin' }} />,
    )

    expect(container.textContent).toContain(
      'Times in your conversations are shown in this zone',
    )
    expect(container.textContent).not.toContain('so times follow this device')
  })
})
