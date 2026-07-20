import { beforeEach, describe, expect, it } from 'vitest'
import {
  RECENT_WORKSPACES_KEY,
  readRecent,
  writeRecent,
} from './recently-viewed-store'

const storageEntries = new Map<string, string>()
const localStorageMock: Storage = {
  get length() {
    return storageEntries.size
  },
  clear() {
    storageEntries.clear()
  },
  getItem(key) {
    return storageEntries.get(key) ?? null
  },
  key(index) {
    return Array.from(storageEntries.keys())[index] ?? null
  },
  removeItem(key) {
    storageEntries.delete(key)
  },
  setItem(key, value) {
    storageEntries.set(key, value)
  },
}

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: localStorageMock,
})

describe('recently viewed store', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('persists a workspace icon', () => {
    writeRecent(RECENT_WORKSPACES_KEY, {
      icon: 'rocket',
      id: 'workspace-1',
      name: 'Sales',
    })

    expect(readRecent(RECENT_WORKSPACES_KEY)).toEqual([
      expect.objectContaining({
        icon: 'rocket',
        id: 'workspace-1',
        name: 'Sales',
      }),
    ])
  })

  it('keeps older workspace entries without an icon', () => {
    window.localStorage.setItem(
      RECENT_WORKSPACES_KEY,
      JSON.stringify([{ at: 1, id: 'workspace-1', name: 'Sales' }]),
    )

    expect(readRecent(RECENT_WORKSPACES_KEY)).toEqual([
      { at: 1, id: 'workspace-1', name: 'Sales' },
    ])
  })
})
