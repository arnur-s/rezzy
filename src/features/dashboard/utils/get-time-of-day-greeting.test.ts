import { setActiveTimeZone } from '@/lib/time-zone'
import { afterEach, describe, expect, it } from 'vitest'
import { getTimeOfDay } from './get-time-of-day-greeting'

/**
 * The bug this guards: the greeting read the machine's clock, so a Berlin
 * account signing in from Singapore was wished good morning at eleven at night.
 * It is the first line on the home page, which makes it the most conspicuous
 * place for the app to be wrong about where the reader is.
 */
describe('getTimeOfDay', () => {
  afterEach(() => {
    setActiveTimeZone(null)
  })

  it('reads the account clock rather than the machine clock', () => {
    // 19:00 UTC in May: 20:00 in London, which is BST, and 04:00 in Tokyo.
    // So the same instant is one account's evening and another's night.
    const instant = new Date('2026-05-14T19:00:00Z')

    setActiveTimeZone('Europe/London')
    expect(getTimeOfDay(instant)).toBe('evening')

    setActiveTimeZone('Asia/Tokyo')
    expect(getTimeOfDay(instant)).toBe('night')
  })

  it('puts midnight in the night bucket rather than off the end of the scale', () => {
    setActiveTimeZone('UTC')

    expect(getTimeOfDay(new Date('2026-05-14T00:30:00Z'))).toBe('night')
    expect(getTimeOfDay(new Date('2026-05-14T05:30:00Z'))).toBe('morning')
    expect(getTimeOfDay(new Date('2026-05-14T13:00:00Z'))).toBe('afternoon')
    expect(getTimeOfDay(new Date('2026-05-14T23:00:00Z'))).toBe('night')
  })
})
