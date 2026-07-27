import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WORKSPACE_CURATED_ICONS } from '../lib/workspace-icons'
import { WorkspaceIcon } from './workspace-icon'
import { WorkspaceIconPicker } from './workspace-icon-picker'

/**
 * Covers the contract that replaced `DynamicIcon`: every curated name resolves
 * to a real component, and unknown names degrade to the default rather than
 * rendering nothing.
 *
 * `DynamicIcon` resolved names at runtime through a map of every Lucide icon,
 * so a bad name was a silently blank square. The static map makes a missing
 * entry a type error; these assert the runtime half of that guarantee.
 */
describe('WorkspaceIcon', () => {
  it.each(WORKSPACE_CURATED_ICONS)('renders an svg for %s', (name) => {
    const { container } = render(<WorkspaceIcon name={name} />)
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it.each([null, undefined, 'not-an-icon'])(
    'falls back to an svg for %s rather than rendering nothing',
    (name) => {
      const { container } = render(<WorkspaceIcon name={name} />)
      expect(container.querySelector('svg')).not.toBeNull()
    },
  )

  it('passes className through so callers control size', () => {
    const { container } = render(
      <WorkspaceIcon name="rocket" className="size-4" />,
    )
    expect(container.querySelector('svg')?.getAttribute('class')).toContain(
      'size-4',
    )
  })
})

describe('WorkspaceIconPicker', () => {
  it('offers every curated icon', () => {
    render(<WorkspaceIconPicker onChange={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(
      WORKSPACE_CURATED_ICONS.length,
    )
  })

  it('reports the icon that was chosen', () => {
    const onChange = vi.fn()
    render(<WorkspaceIconPicker onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'rocket' }))

    expect(onChange).toHaveBeenCalledWith('rocket')
  })

  it('disables every option while the form is disabled', () => {
    render(<WorkspaceIconPicker onChange={vi.fn()} isDisabled />)
    for (const button of screen.getAllByRole('button')) {
      expect((button as HTMLButtonElement).disabled).toBe(true)
    }
  })
})
