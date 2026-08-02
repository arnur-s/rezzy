import { displayReactionEmoji } from '@/entities/message'
import { cn } from '@/lib/cn'
import { normalizeReactionEmoji } from '@/lib/reaction-emoji'
import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { Popover } from '@astryxdesign/core/Popover'
import { SmilePlusIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { MessageActionAnchor } from './message-action-menu'

type Props = {
  isOutbound: boolean
  messageId: string
  /** Canonical emoji this workspace holds on the message, if any. */
  currentEmoji: string | null
  supportedEmoji: ReadonlyArray<string>
  isDisabled: boolean
  /** Why the control is disabled, said in words rather than implied. */
  disabledReason: string | null
  /**
   * The single sequential tab stop in the transcript. Every other trigger is
   * reached with the arrow keys instead.
   */
  isTabStop: boolean
  anchor: MessageActionAnchor
  /**
   * Controlled so the touch path can reach it: press-and-hold opens the message
   * action menu, and "React" there opens this picker.
   */
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onSelect: (emoji: string) => void
}

/**
 * The reaction affordance: a quiet trigger in the transcript gutter that opens
 * a row of the provider's supported emoji.
 *
 * Deliberately not a full emoji browser. Reactions are a secondary interaction,
 * the providers accept a fixed set, and a picker that takes a moment to search
 * costs more than the reaction is worth.
 *
 * The trigger mirrors `MessageActionMenu`'s placement rules so the two controls
 * sit on one line in the gutter and reveal together.
 */
export function ReactionPicker({
  isOutbound,
  messageId,
  currentEmoji,
  supportedEmoji,
  isDisabled,
  disabledReason,
  isTabStop,
  anchor,
  isOpen,
  onOpenChange,
  onSelect,
}: Props) {
  const triggerRef = useRef<HTMLSpanElement | null>(null)

  const label = currentEmoji
    ? m.inbox_reaction_change()
    : m.inbox_reaction_add()

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open)
    // Escape and outside-click both land here. Focus goes back to the trigger
    // rather than to the top of the transcript, so a keyboard user resumes
    // where they were — the picker is a detour, not a destination.
    if (!open) {
      triggerRef.current?.querySelector('button')?.focus()
    }
  }

  return (
    <span
      ref={triggerRef}
      className={cn(
        'absolute flex items-center transition-opacity duration-150 ease-out motion-reduce:transition-none',
        // Matches MessageActionMenu: centers the control on the first 20px line
        // inside the bubble's 12px padding-block, or marks a block at its middle.
        anchor === 'first-line' ? 'top-2' : 'top-1/2 -translate-y-1/2',
        isOpen
          ? 'opacity-100'
          : cn(
              'pointer-events-none opacity-0',
              'group-hover/row:pointer-events-auto group-hover/row:opacity-100',
              'group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100',
              // Touch has no hover. The long-press menu is the primary path
              // there, but the control stays quietly present so a screen-reader
              // user — who cannot press and hold — still has a way in.
              '[@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-60',
            ),
        // Outboard of the action menu, which occupies the first slot.
        isOutbound ? 'right-full mr-7 pr-1' : 'left-full ml-7 pl-1',
      )}
    >
      <Popover
        isOpen={isOpen}
        onOpenChange={handleOpenChange}
        label={m.inbox_reaction_picker_label()}
        placement="above"
        alignment={isOutbound ? 'end' : 'start'}
        content={
          <ReactionOptions
            supportedEmoji={supportedEmoji}
            currentEmoji={currentEmoji}
            onSelect={(emoji) => {
              onSelect(emoji)
              handleOpenChange(false)
            }}
          />
        }
      >
        <Button
          label={label}
          tooltip={disabledReason ?? label}
          icon={<SmilePlusIcon className="size-3.5" aria-hidden />}
          isIconOnly
          variant="ghost"
          size="sm"
          isDisabled={isDisabled}
          tabIndex={isTabStop ? 0 : -1}
          data-reaction-trigger-for={messageId}
          // The 28px control keeps its compact mark; touch gets the 44px target.
          className="[@media(hover:none)]:after:absolute [@media(hover:none)]:after:-inset-2 [@media(hover:none)]:after:content-['']"
        />
      </Popover>
    </span>
  )
}

/**
 * The emoji row. A toolbar rather than a list of independent buttons: one tab
 * stop enters it and the arrow keys move within, which is what a compact row of
 * peer controls should do and what saves a keyboard user six tab presses to get
 * past it.
 */
function ReactionOptions({
  supportedEmoji,
  currentEmoji,
  onSelect,
}: {
  supportedEmoji: ReadonlyArray<string>
  currentEmoji: string | null
  onSelect: (emoji: string) => void
}) {
  const normalizedCurrent = currentEmoji
    ? normalizeReactionEmoji(currentEmoji)
    : null
  // Opening on the emoji already held makes the common follow-up — withdraw it
  // again — a single keystroke.
  const initialIndex = Math.max(
    supportedEmoji.findIndex((emoji) => emoji === normalizedCurrent),
    0,
  )
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    buttonsRef.current[activeIndex]?.focus()
  }, [activeIndex])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const lastIndex = supportedEmoji.length - 1
    // Undefined in the value type: any other key falls through to the browser.
    const moves: Record<string, number | undefined> = {
      ArrowRight: activeIndex === lastIndex ? 0 : activeIndex + 1,
      ArrowLeft: activeIndex === 0 ? lastIndex : activeIndex - 1,
      Home: 0,
      End: lastIndex,
    }
    const next = moves[event.key]
    if (next === undefined) return
    event.preventDefault()
    setActiveIndex(next)
  }

  return (
    <div
      role="toolbar"
      aria-orientation="horizontal"
      aria-label={m.inbox_reaction_picker_label()}
      onKeyDown={handleKeyDown}
      className="flex items-center gap-0.5 p-1"
    >
      {supportedEmoji.map((emoji, index) => {
        const isSelected = emoji === normalizedCurrent
        return (
          <button
            key={emoji}
            ref={(element) => {
              buttonsRef.current[index] = element
            }}
            type="button"
            // Roving tabindex: the toolbar is one stop, the arrows do the rest.
            tabIndex={index === activeIndex ? 0 : -1}
            aria-pressed={isSelected}
            aria-label={
              isSelected
                ? m.inbox_reaction_selected({ emoji })
                : m.inbox_reaction_with({ emoji })
            }
            onClick={() => onSelect(emoji)}
            onFocus={() => setActiveIndex(index)}
            className={cn(
              'flex size-9 items-center justify-center rounded-full text-base',
              'transition-transform duration-150 ease-out motion-reduce:transition-none',
              'hover:bg-primary/8 hover:scale-110',
              'focus-visible:ring-primary/40 focus-visible:ring-2 focus-visible:outline-none',
              // The held reaction is marked, not merely remembered, so the
              // withdraw affordance is visible rather than discovered.
              isSelected && 'bg-primary/12',
            )}
          >
            <span aria-hidden>{displayReactionEmoji(emoji)}</span>
          </button>
        )
      })}
    </div>
  )
}
