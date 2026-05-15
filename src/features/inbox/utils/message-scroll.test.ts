import { describe, expect, it } from 'vitest'
import { isNearBottom } from './message-scroll'

function scrollState({
  scrollHeight,
  scrollTop,
  clientHeight,
}: {
  scrollHeight: number
  scrollTop: number
  clientHeight: number
}) {
  return { scrollHeight, scrollTop, clientHeight }
}

describe('isNearBottom', () => {
  it('returns true when remaining scroll distance is within the threshold', () => {
    expect(
      isNearBottom(
        scrollState({ scrollHeight: 1000, scrollTop: 760, clientHeight: 140 }),
        120,
      ),
    ).toBe(true)
  })

  it('returns false when remaining scroll distance is beyond the threshold', () => {
    expect(
      isNearBottom(
        scrollState({ scrollHeight: 1000, scrollTop: 700, clientHeight: 140 }),
        120,
      ),
    ).toBe(false)
  })

  it('uses 120px as the default threshold', () => {
    expect(
      isNearBottom(
        scrollState({ scrollHeight: 1000, scrollTop: 750, clientHeight: 130 }),
      ),
    ).toBe(true)
  })
})
