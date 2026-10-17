import { describe, expect, it } from 'vitest'
import { buildFontFloor } from './font-floor-build.mjs'

describe('Astryx font-floor generation', () => {
  it('derives changed hashes and retains proportional sizes above the floor', () => {
    const result = buildFontFloor(
      '@layer astryx-base {.newhash:not(#\\#){font-size:10px}.avatarhash{font-size:var(--x-fontSize)}.body{font-size:14px}}',
      'next',
    )
    expect(result).toContain('.newhash:not(#\\#)')
    expect(result).toContain('font-size: max(0.75rem, 10px)')
    expect(result).toContain('font-size: max(0.75rem, var(--x-fontSize))')
    expect(result).not.toContain('.body')
  })

  it('leaves the theme scale and already readable literals alone', () => {
    const result = buildFontFloor(
      '.a{font-size:var(--font-size-xs)}.b{font-size:.75rem}.c{font-size:12px}.d{font-size:.6rem}',
      'next',
    )
    expect(result).not.toContain('.a {')
    expect(result).not.toContain('.b {')
    expect(result).not.toContain('.c {')
    expect(result).toContain('max(0.75rem, .6rem)')
  })

  it('fails visibly if an upgrade changes the supported CSS contract', () => {
    expect(() => buildFontFloor('', 'next')).toThrow('No Astryx font-size')
    expect(() => buildFontFloor('.a{font-size:calc(1em / 2)}', 'next')).toThrow(
      'Review new Astryx font-size',
    )
    expect(() => buildFontFloor('.a:hover{font-size:10px}', 'next')).toThrow(
      'Review new Astryx font-floor selector',
    )
  })
})
