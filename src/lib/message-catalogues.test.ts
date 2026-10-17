import { describe, expect, it } from 'vitest'
import en from '../../messages/en.json'
import ru from '../../messages/ru.json'

function inputs(message: unknown): Array<string> {
  const source = JSON.stringify(message)
  return [
    ...new Set([
      ...Array.from(source.matchAll(/\{\s*(\w+)\s*\}/g), (match) => match[1]),
      ...Array.from(source.matchAll(/"input (\w+)"/g), (match) => match[1]),
    ]),
  ].sort()
}

describe('message catalogue contracts', () => {
  it('keeps Russian and English key sets in sync', () => {
    expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort())
  })

  it('preserves interpolation inputs across locales, including plural selectors', () => {
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(inputs(ru[key]), key).toEqual(inputs(en[key]))
    }
  })
})
