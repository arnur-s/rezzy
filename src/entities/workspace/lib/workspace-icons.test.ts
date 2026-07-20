import { describe, expect, it } from 'vitest'
import {
  WORKSPACE_DEFAULT_ICON,
  resolveWorkspaceIcon,
} from './workspace-icons'

describe('resolveWorkspaceIcon', () => {
  it('keeps valid Lucide icon names', () => {
    expect(resolveWorkspaceIcon('rocket')).toBe('rocket')
  })

  it.each([null, undefined, 'not-a-lucide-icon'])(
    'falls back for an unavailable icon name',
    (icon) => {
      expect(resolveWorkspaceIcon(icon)).toBe(WORKSPACE_DEFAULT_ICON)
    },
  )
})
