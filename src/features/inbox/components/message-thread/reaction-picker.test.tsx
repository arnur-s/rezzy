import { setLocale } from '@/paraglide/runtime'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReactionPicker } from './reaction-picker'

/**
 * The picker is a keyboard surface before it is a hover surface: an agent
 * working a queue reaches it with Tab and the arrow keys, and a touch user
 * reaches it without hover at all. These tests pin the behaviour that makes
 * either possible.
 */

const HEART = String.fromCodePoint(0x2764)
const THUMBS_UP = String.fromCodePoint(0x1f44d)
const LAUGH = String.fromCodePoint(0x1f602)
const EMOJI = [THUMBS_UP, HEART, LAUGH]

function Harness({
  currentEmoji = null,
  isDisabled = false,
  disabledReason = null,
  onSelect = vi.fn(),
  startOpen = false,
}: {
  currentEmoji?: string | null
  isDisabled?: boolean
  disabledReason?: string | null
  onSelect?: (emoji: string) => void
  startOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(startOpen)
  return (
    <ReactionPicker
      isOutbound={false}
      messageId="msg-1"
      currentEmoji={currentEmoji}
      supportedEmoji={EMOJI}
      isDisabled={isDisabled}
      disabledReason={disabledReason}
      isTabStop
      anchor="first-line"
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      onSelect={onSelect}
    />
  )
}

function trigger() {
  return screen.getByRole('button', { name: 'React to message' })
}

function options() {
  return within(screen.getByRole('toolbar')).getAllByRole('button')
}

beforeEach(() => {
  setLocale('en', { reload: false })
})

describe('opening and closing', () => {
  it('opens from the keyboard', () => {
    render(<Harness />)
    expect(screen.queryByRole('toolbar')).toBeNull()

    // Enter on the focused trigger, not a synthesized pointer event.
    const button = trigger()
    button.focus()
    fireEvent.keyDown(button, { key: 'Enter' })
    fireEvent.click(button)

    expect(screen.getByRole('toolbar')).not.toBeNull()
  })

  it('closes on Escape and puts focus back on the trigger', () => {
    render(<Harness startOpen />)
    const toolbar = screen.getByRole('toolbar')

    fireEvent.keyDown(toolbar, { key: 'Escape' })

    expect(screen.queryByRole('toolbar')).toBeNull()
    // The picker is a detour: focus resumes where the agent left it, rather
    // than falling back to the top of the transcript.
    expect(document.activeElement).toBe(trigger())
  })

  it('closes after a selection', () => {
    render(<Harness startOpen />)
    fireEvent.click(options()[0])
    expect(screen.queryByRole('toolbar')).toBeNull()
  })
})

describe('accessible names', () => {
  it('names the trigger for what it will do', () => {
    const { rerender } = render(<Harness />)
    expect(trigger()).not.toBeNull()

    // With a reaction already held, the same control changes rather than adds.
    rerender(<Harness currentEmoji={HEART} />)
    expect(screen.getByRole('button', { name: 'Change reaction' })).not.toBeNull()
  })

  it('names every emoji control', () => {
    render(<Harness startOpen />)
    for (const emoji of EMOJI) {
      expect(screen.getByRole('button', { name: `React with ${emoji}` })).not.toBeNull()
    }
  })

  it('announces which reaction is the current one', () => {
    render(<Harness currentEmoji={HEART} startOpen />)

    const held = screen.getByRole('button', { name: `${HEART}, your reaction` })
    expect(held.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: `React with ${THUMBS_UP}` }).getAttribute('aria-pressed')).toBe('false')
  })
})

describe('keyboard navigation', () => {
  it('is a single tab stop with the arrows moving inside it', () => {
    render(<Harness startOpen />)
    const [first, second, third] = options()

    // Roving tabindex: one control is reachable by Tab, the rest by arrows.
    expect(first.tabIndex).toBe(0)
    expect(second.tabIndex).toBe(-1)
    expect(third.tabIndex).toBe(-1)

    fireEvent.keyDown(screen.getByRole('toolbar'), { key: 'ArrowRight' })
    expect(document.activeElement).toBe(options()[1])

    fireEvent.keyDown(screen.getByRole('toolbar'), { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(options()[0])
  })

  it('wraps at both ends', () => {
    render(<Harness startOpen />)
    const toolbar = screen.getByRole('toolbar')

    fireEvent.keyDown(toolbar, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(options()[EMOJI.length - 1])

    fireEvent.keyDown(toolbar, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(options()[0])
  })

  it('jumps to the ends with Home and End', () => {
    render(<Harness startOpen />)
    const toolbar = screen.getByRole('toolbar')

    fireEvent.keyDown(toolbar, { key: 'End' })
    expect(document.activeElement).toBe(options()[EMOJI.length - 1])

    fireEvent.keyDown(toolbar, { key: 'Home' })
    expect(document.activeElement).toBe(options()[0])
  })

  it('opens on the emoji already held, so withdrawing it is one keystroke', () => {
    render(<Harness currentEmoji={LAUGH} startOpen />)
    expect(options()[EMOJI.indexOf(LAUGH)].tabIndex).toBe(0)
  })
})

describe('selection', () => {
  it('reports the emoji the agent picked', () => {
    const onSelect = vi.fn()
    render(<Harness startOpen onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: `React with ${HEART}` }))

    expect(onSelect).toHaveBeenCalledWith(HEART)
  })

  it('reports the held emoji too, which the caller reads as a withdrawal', () => {
    const onSelect = vi.fn()
    render(<Harness currentEmoji={HEART} startOpen onSelect={onSelect} />)

    fireEvent.click(
      screen.getByRole('button', { name: `${HEART}, your reaction` }),
    )

    expect(onSelect).toHaveBeenCalledWith(HEART)
  })
})

describe('disabled state', () => {
  it('says why instead of being silently inert', () => {
    render(
      <Harness
        isDisabled
        disabledReason="Deleted messages can’t be reacted to"
      />,
    )
    expect(trigger().getAttribute('aria-disabled')).toBe('true')
  })
})
