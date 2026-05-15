import { describe, expect, it } from 'vitest'
import { isNearBottom, preserveScrollTopAfterContentGrowth } from './message-scroll'

describe('isNearBottom', () => {
  it('returns true within default threshold of bottom', () => {
    expect(
      isNearBottom({
        scrollHeight: 1000,
        clientHeight: 400,
        scrollTop: 520,
      }),
    ).toBe(true)
  })

  it('returns false when above default threshold', () => {
    expect(
      isNearBottom({
        scrollHeight: 1000,
        clientHeight: 400,
        scrollTop: 400,
      }),
    ).toBe(false)
  })
})

describe('preserveScrollTopAfterContentGrowth', () => {
  it('adjusts scrollTop so content above the fold stays aligned after prepend', () => {
    expect(
      preserveScrollTopAfterContentGrowth({
        previousScrollHeight: 800,
        previousScrollTop: 200,
        newScrollHeight: 1200,
      }),
    ).toBe(600)
  })
})
