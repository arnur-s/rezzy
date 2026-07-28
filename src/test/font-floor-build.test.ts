import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import {
  FLOOR_PX,
  OUTPUT_PATH,
  findFloorCandidates,
  renderStylesheet,
} from '../../scripts/font-floor-build.mjs'

type Candidate = { className: string; value: string; reason: string }

const findCandidates = findFloorCandidates as (css: string) => Array<Candidate>
const render = renderStylesheet as (
  candidates: Array<Candidate>,
  options: { version: string },
) => string

/** A rule in the shape StyleX emits, specificity hack included. */
const rule = (className: string, value: string) =>
  `.${className}:not(#\\#):not(#\\#):not(#\\#){font-size:${value}}`

describe('findFloorCandidates', () => {
  it('selects literal sizes below the floor', () => {
    const found = findCandidates(rule('xsmall', '10px'))
    expect(found).toEqual([
      { className: 'xsmall', value: '10px', reason: 'literal' },
    ])
  })

  it('leaves literal sizes at or above the floor alone', () => {
    expect(findCandidates(rule('xfine', '12px'))).toEqual([])
    expect(findCandidates(rule('xfine', '0.75rem'))).toEqual([])
    expect(findCandidates(rule('xfine', '1rem'))).toEqual([])
  })

  it('converts rem against the 16px root before comparing', () => {
    // 0.625rem is 10px, below the floor despite reading as a "large" number.
    expect(findCandidates(rule('xrem', '0.625rem'))).toHaveLength(1)
  })

  it('selects sizes computed inline per instance', () => {
    const found = findCandidates(rule('xdyn', 'var(--x-fontSize)'))
    expect(found).toEqual([
      { className: 'xdyn', value: 'var(--x-fontSize)', reason: 'inline-dynamic' },
    ])
  })

  it('leaves theme-token sizes to the theme', () => {
    // gothicTheme.ts clamps the token scale; overriding here would fight it.
    expect(findCandidates(rule('xtok', 'var(--font-size-3xs)'))).toEqual([])
    expect(findCandidates(rule('xtok', 'var(--text-supporting-size)'))).toEqual([])
  })

  it('ignores non-font-size declarations and keywords', () => {
    expect(findCandidates('.xpad:not(#\\#){padding:4px}')).toEqual([])
    expect(findCandidates(rule('xinherit', 'inherit'))).toEqual([])
    expect(findCandidates(rule('xmax', 'max(1rem,var(--text-body-size))'))).toEqual([])
  })

  it('reports each class once and in a stable order', () => {
    const css = [rule('xb', '8px'), rule('xa', '10px'), rule('xb', '8px')].join('\n')
    expect(findCandidates(css).map((c) => c.className)).toEqual(['xa', 'xb'])
  })
})

describe('renderStylesheet', () => {
  it('emits a max() floor inside the components layer', () => {
    const css = render(findCandidates(rule('xsmall', '10px')), { version: '0.0.0' })
    expect(css).toContain('@layer components {')
    // max() keeps it a floor: a larger computed value still wins.
    expect(css).toContain(`font-size: max(${FLOOR_PX / 16}rem, 10px);`)
    expect(css).toContain('@astryxdesign/core@0.0.0')
  })

  it('stays valid when a version has nothing below the floor', () => {
    const css = render([], { version: '9.9.9' })
    expect(css).not.toContain('@layer components')
    expect(css).toContain('No Astryx font-size falls below the floor')
  })
})

describe('the committed stylesheet', () => {
  it('matches the installed Astryx', () => {
    // The hashes are a dependency build output, so a stale file silently stops
    // matching anything. `pnpm check:font-floor` runs this same comparison in CI.
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
    const require = createRequire(import.meta.url)
    const cssPath = require.resolve('@astryxdesign/core/astryx.css')
    const version = JSON.parse(
      fs.readFileSync(path.join(path.dirname(cssPath), '..', 'package.json'), 'utf8'),
    ).version as string

    const expected = render(findCandidates(fs.readFileSync(cssPath, 'utf8')), { version })
    const actual = fs.readFileSync(path.join(root, OUTPUT_PATH), 'utf8')

    expect(actual).toBe(expected)
  })
})
