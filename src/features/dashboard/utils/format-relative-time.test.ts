import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from './format-relative-time'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-07-24T12:00:00Z')
  const at = (msAgo: number) => new Date(now - msAgo).toISOString()

  it('keeps the sub-day tiers', () => {
    expect(formatRelativeTime(at(30_000), now)).toMatch(/just now|только что/)
    expect(formatRelativeTime(at(5 * 60_000), now)).toContain('5')
    expect(formatRelativeTime(at(3 * HOUR_MS), now)).toContain('3')
  })

  it('rolls days into weeks, months, and years instead of "70d ago"', () => {
    expect(formatRelativeTime(at(6 * DAY_MS), now)).toContain('6')
    expect(formatRelativeTime(at(10 * DAY_MS), now)).toContain('1')
    expect(formatRelativeTime(at(70 * DAY_MS), now)).toContain('2')
    expect(formatRelativeTime(at(400 * DAY_MS), now)).toContain('1')
    // The 70-day case must not fall through to the day tier.
    expect(formatRelativeTime(at(70 * DAY_MS), now)).not.toContain('70')
  })

  it('returns empty string for invalid input', () => {
    expect(formatRelativeTime('not-a-date', now)).toBe('')
  })
})
