import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu'
import type { DropdownMenuOption } from '@astryxdesign/core/DropdownMenu'
import { MoreVerticalIcon } from 'lucide-react'

/** Where the trigger sits vertically: on a line of text, or against a block. */
export type MessageActionAnchor = 'first-line' | 'block'

type Props = {
  isOutbound: boolean
  messageId: string
  /**
   * The single sequential tab stop in the transcript. Every other trigger is
   * reached with the arrow keys instead.
   */
  isTabStop: boolean
  anchor: MessageActionAnchor
  items: Array<DropdownMenuOption>
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

/**
 * Message-scoped actions, parked in the transcript gutter beside the bubble
 * rather than inside the metadata footer — the footer is a status readout, and
 * an action mixed into it lands at a different x on every message depending on
 * which telemetry happens to be present.
 *
 * The trigger is a DOM child of the bubble, so hovering it keeps the bubble's
 * `:hover` alive; the inline padding (not a margin) puts the visual gap inside
 * the trigger's own hit area so the pointer never crosses a dead zone on the
 * way. It reveals on `group/row` — the full-width row — rather than on the
 * bubble, so aiming at a two-word message does not mean aiming at two words.
 */
export function MessageActionMenu({
  isOutbound,
  messageId,
  isTabStop,
  anchor,
  items,
  isOpen,
  onOpenChange,
}: Props) {
  return (
    <span
      className={cn(
        'absolute flex items-center transition-opacity duration-150 ease-out motion-reduce:transition-none',
        // top-2 centers the 28px control on the first 20px line inside the
        // bubble's 12px padding-block; a block is marked at its middle.
        anchor === 'first-line' ? 'top-2' : 'top-1/2 -translate-y-1/2',
        // The open state is emitted as the *only* opacity rule rather than as
        // one more class racing the others: the menu popup is a DOM child of
        // this span, and leaving a fractional opacity on it while the popup is
        // open risks taking the popup down with it.
        isOpen
          ? 'opacity-100'
          : cn(
              // No hit target until the message is engaged, so the empty
              // gutter stays empty.
              'pointer-events-none opacity-0',
              'group-hover/row:pointer-events-auto group-hover/row:opacity-100',
              'group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100',
              // Touch has no hover to reveal it. Press-and-hold is the primary
              // path there, but the control stays quietly present so a
              // screen-reader user — who cannot press and hold — has a way in.
              '[@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-60',
            ),
        isOutbound ? 'right-full pr-1' : 'left-full pl-1',
      )}
    >
      <DropdownMenu
        hasChevron={false}
        menuWidth={200}
        isMenuOpen={isOpen}
        onOpenChange={onOpenChange}
        items={items}
        button={{
          label: m.inbox_message_actions(),
          tooltip: m.inbox_message_actions(),
          icon: <MoreVerticalIcon className="size-3.5" aria-hidden />,
          isIconOnly: true,
          variant: 'ghost',
          size: 'sm',
          tabIndex: isTabStop ? 0 : -1,
          'data-message-actions-for': messageId,
          // The 28px control keeps its compact mark; touch gets the 44px target.
          className:
            "[@media(hover:none)]:after:absolute [@media(hover:none)]:after:-inset-2 [@media(hover:none)]:after:content-['']",
        }}
      />
    </span>
  )
}
