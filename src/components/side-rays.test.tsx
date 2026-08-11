import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SideRays, hexToRgb, originToFlip } from './side-rays'

/**
 * The shared setup's IntersectionObserver stub never fires, so by default
 * `isVisible` stays false and the WebGL effect is skipped entirely. Swap in one
 * that reports the container as visible so the GL path is actually exercised.
 *
 * Restores the setup's own stub rather than calling `vi.unstubAllGlobals()`,
 * which would delete it and break every later test in the file.
 */
const setupObserver = globalThis.IntersectionObserver

function observeAsVisible() {
  globalThis.IntersectionObserver = class {
    constructor(private callback: IntersectionObserverCallback) {}
    observe() {
      this.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      )
    }
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
    readonly root = null
    readonly rootMargin = ''
    readonly thresholds = []
  } as unknown as typeof IntersectionObserver
}

afterEach(() => {
  globalThis.IntersectionObserver = setupObserver
})

describe('hexToRgb', () => {
  it('normalizes hex to 0..1 channels, with or without the hash', () => {
    expect(hexToRgb('#ffffff')).toEqual([1, 1, 1])
    expect(hexToRgb('000000')).toEqual([0, 0, 0])
    expect(hexToRgb('#63FE13')).toEqual([99 / 255, 254 / 255, 19 / 255])
  })

  it('falls back to white rather than NaN uniforms on bad input', () => {
    // NaN in a uniform silently blanks the shader, so the guard matters.
    expect(hexToRgb('#fff')).toEqual([1, 1, 1])
    expect(hexToRgb('not a color')).toEqual([1, 1, 1])
    expect(hexToRgb('')).toEqual([1, 1, 1])
  })
})

describe('originToFlip', () => {
  it('mirrors the axes needed to reach each corner', () => {
    expect(originToFlip('top-right')).toEqual([0, 0])
    expect(originToFlip('top-left')).toEqual([1, 0])
    expect(originToFlip('bottom-right')).toEqual([0, 1])
    expect(originToFlip('bottom-left')).toEqual([1, 1])
  })
})

describe('SideRays', () => {
  it('renders a decorative, non-interactive container', () => {
    const { container } = render(<SideRays />)
    const el = container.firstElementChild

    expect(el).not.toBeNull()
    expect(el?.getAttribute('aria-hidden')).toBe('true')
    expect(el?.className).toContain('pointer-events-none')
  })

  // jsdom has no WebGL, which is the same situation as a blocklisted driver or
  // an exhausted context pool. ogl logs rather than throwing and leaves `gl`
  // unset, so an unguarded port throws out of the effect and unmounts the
  // whole thread. The decoration must drop out silently instead.
  it('degrades to an empty container when no WebGL context is available', () => {
    observeAsVisible()
    // ogl's own console.error for the missing context is the expected path.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<SideRays />)).not.toThrow()

    consoleError.mockRestore()
  })

  it('keeps caller classes so the caller owns stacking', () => {
    const { container } = render(<SideRays className="-z-10" />)
    expect(container.firstElementChild?.className).toContain('-z-10')
  })
})
