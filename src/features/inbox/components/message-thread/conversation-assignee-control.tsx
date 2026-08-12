import {
  WorkspaceMemberCard,
  workspaceMemberFirstName,
  workspaceMemberLabels,
} from '@/entities/workspace'
import type { WorkspaceMember } from '@/entities/workspace'
import { useWorkspaceMemberDirectory } from '@/features/workspaces/hooks/use-workspaces'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { Avatar } from '@astryxdesign/core/Avatar'
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu'
import type {
  DropdownMenuButtonProps,
  DropdownMenuOption,
} from '@astryxdesign/core/DropdownMenu'
import { HoverCard } from '@astryxdesign/core/HoverCard'
import { Skeleton } from '@astryxdesign/core/Skeleton'
import { useToast } from '@astryxdesign/core/Toast'
import { ChevronDownIcon, UserRoundIcon, UserRoundPlusIcon } from 'lucide-react'
import { useState } from 'react'
import { useUpdateConversationAssignee } from '../../hooks/use-conversations'

type Props = {
  workspaceId: string
  conversationId: string
  assignedTo: string | null
  /** The signed-in agent, so the roster can offer "assign to me" first. */
  currentUserId: string | null
}

/**
 * Who is on this conversation, and the control that changes it.
 *
 * It replaces a run of static text ("Assigned to Anna") that sat in the
 * header's metadata line between the channel and the phone number. That line
 * is a list of facts about the customer; the assignee is the one fact about the
 * *team*, it is the only mutable thing in the row, and it looked exactly like
 * the immutable ones beside it. Worse, it rendered nothing at all when nobody
 * was assigned — the single state that most needs an action was the state with
 * no pixels.
 *
 * So it moves out of the facts and into the header's action cluster, beside the
 * status control, because assigning and closing are the same gesture at
 * different angles: both are "route this away from me". The face carries
 * recognition, the name carries the answer, hovering carries the role and the
 * phone for the case where the next step is to go and ask them, and clicking
 * carries the change. Unassigned reads as an invitation rather than a gap.
 *
 * The hover card is suppressed while the menu is open. Both anchor to the same
 * button, and a card sliding out from under an open menu is two overlays
 * arguing about one trigger.
 */
export function ConversationAssigneeControl({
  workspaceId,
  conversationId,
  assignedTo,
  currentUserId,
}: Props) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const showToast = useToast()
  const directory = useWorkspaceMemberDirectory(workspaceId)
  const updateAssignee = useUpdateConversationAssignee(workspaceId)

  const members = directory.data ?? []
  const assignee = assignedTo
    ? (members.find((member) => member.userId === assignedTo) ?? null)
    : null
  const isUnresolved =
    assignedTo !== null && directory.data !== undefined && assignee === null
  // An assigned conversation must not read "Assign" for the length of the
  // roster fetch. Nobody is going to see that flash and wait to find out it was
  // a lie — they will click it.
  const isResolvingAssignee = assignedTo !== null && directory.data === undefined

  function apply(nextAssignedTo: string | null) {
    if (nextAssignedTo === assignedTo) return
    updateAssignee.mutate(
      { conversationId, assignedTo: nextAssignedTo },
      {
        onError: () => {
          showToast({ body: m.inbox_assignee_change_error(), type: 'error' })
        },
      },
    )
  }

  if (isResolvingAssignee) {
    return (
      <span
        className="flex items-center gap-1.5 px-1.5"
        aria-label={m.inbox_assignee_label()}
        aria-busy
      >
        <Skeleton width={20} height={20} radius="rounded" />
        <Skeleton width={64} height={12} radius={2} />
      </span>
    )
  }

  const label = triggerLabel({ assignee, isUnresolved })

  const items = buildMenuItems({
    members,
    assignedTo,
    currentUserId,
    isPending: directory.isPending,
    isError: directory.isError,
    onPick: apply,
  })

  const button: DropdownMenuButtonProps = {
    // What the control does, not just who it names — the visible text is the
    // person, the accessible name has to be the fact plus the person.
    label: assignee
      ? m.inbox_assigned_to({ name: assignee.fullName })
      : isUnresolved
        ? m.inbox_assigned_to({ name: m.inbox_assignee_former_member() })
        : m.inbox_assignee_assign_cta(),
    variant: 'ghost',
    size: 'sm',
    // Button centres its content and sets medium weight. This one has to read
    // as a person sitting in a toolbar rather than as a labelled action, so the
    // inset tightens to the icon buttons beside it and the weight drops to the
    // header's own metadata voice.
    className: 'px-1.5 font-normal',
    isDisabled: updateAssignee.isPending,
    children: (
      <span className="flex min-w-0 items-center gap-1.5">
        {assignee ? (
          <Avatar
            size="xsm"
            name={assignee.fullName}
            src={assignee.avatarUrl ?? undefined}
          />
        ) : (
          <span
            className={cn(
              'flex size-5 shrink-0 items-center justify-center rounded-full',
              isUnresolved
                ? 'bg-muted text-secondary'
                : 'text-secondary border-border-strong border border-dashed',
            )}
          >
            {isUnresolved ? (
              <UserRoundIcon className="size-3" aria-hidden />
            ) : (
              <UserRoundPlusIcon className="size-3" aria-hidden />
            )}
          </span>
        )}
        {/* First name only, capped, and dropped entirely below `xl`.

            A full Russian name pushes 200px and arrives as "Анна Петрова-Свир…",
            which spends the width and then throws away the part it bought. The
            face is the identity here; the word beside it only has to
            disambiguate two colleagues.

            Between `lg` and `xl` the thread pane is at its tightest — the
            viewport gives it whatever the rail and the conversation list leave
            — and there the name is what pushes the contact's own name towards
            the edge of their own header. The control keeps its face, its
            chevron and its whole behaviour across that band; it only stops
            narrating an answer the hover card and the menu both still give.
            Below `lg` the header drops the control entirely; see
            message-thread-header. */}
        <span className="hidden max-w-24 truncate xl:inline">{label}</span>
      </span>
    ),
    // Without this the control reads as a caption sitting next to a button.
    // One 12px chevron is the whole difference between a label and a picker.
    endContent: (
      <ChevronDownIcon className="text-secondary size-3 shrink-0" aria-hidden />
    ),
  }

  const trigger = (
    <DropdownMenu
      button={button}
      items={items}
      isMenuOpen={isMenuOpen}
      onOpenChange={setIsMenuOpen}
      placement="below"
      menuWidth={248}
      hasChevron={false}
    />
  )

  if (!assignee) {
    return trigger
  }

  return (
    <HoverCard
      content={<WorkspaceMemberCard member={assignee} />}
      placement="below"
      alignment="end"
      delay={200}
      // `focusin` bubbles, so `always` reaches the button inside this wrapper
      // and a keyboard user tabbing through the header gets the role and the
      // phone too. Without it the card would be pointer-only and the detail
      // would exist nowhere else in the product.
      focusTrigger="always"
      isEnabled={!isMenuOpen}
    >
      {trigger}
    </HoverCard>
  )
}

function triggerLabel({
  assignee,
  isUnresolved,
}: {
  assignee: WorkspaceMember | null
  isUnresolved: boolean
}) {
  if (assignee) return workspaceMemberFirstName(assignee)
  if (isUnresolved) return m.inbox_assignee_former_member()
  return m.inbox_assignee_assign_cta()
}

function buildMenuItems({
  members,
  assignedTo,
  currentUserId,
  isPending,
  isError,
  onPick,
}: {
  members: Array<WorkspaceMember>
  assignedTo: string | null
  currentUserId: string | null
  isPending: boolean
  isError: boolean
  onPick: (assignedTo: string | null) => void
}): Array<DropdownMenuOption> {
  if (isPending) {
    return [{ label: m.inbox_assignee_members_loading(), isDisabled: true }]
  }

  if (isError) {
    return [{ label: m.inbox_assignee_members_error(), isDisabled: true }]
  }

  // "Assign to me" is a separate entry rather than a re-ordering of the roster:
  // the most common triage move is claiming the thread, and hunting for your
  // own name among colleagues is the slowest way to express it. It drops out
  // once the thread is already yours, where it would be a no-op.
  const claimSelf =
    currentUserId && currentUserId !== assignedTo
      ? [
          {
            label: m.inbox_assignee_assign_to_me(),
            icon: <UserRoundPlusIcon className="size-4" />,
            onClick: () => onPick(currentUserId),
          },
        ]
      : []

  // Not `member.fullName`: two colleagues can share one, and DropdownMenu keys
  // its items by label.
  const labels = workspaceMemberLabels(members)

  const roster = members.map((member) => ({
    label: labels.get(member.userId) ?? member.fullName,
    // The same faces the list rows carry, so picking from the menu is
    // recognition rather than reading.
    icon: (
      <Avatar
        size="xsm"
        name={member.fullName}
        src={member.avatarUrl ?? undefined}
      />
    ),
    isDisabled: member.userId === assignedTo,
    onClick: () => onPick(member.userId),
  }))

  const people = [...claimSelf, ...roster]

  if (people.length === 0 && assignedTo === null) {
    return [{ label: m.inbox_assignee_members_error(), isDisabled: true }]
  }

  return [
    ...(people.length > 0
      ? [
          {
            type: 'section' as const,
            title: m.inbox_assignee_label(),
            items: people,
          },
        ]
      : []),
    // Clearing is not one of the people, so it sits below the rule rather than
    // at the end of the roster where it would read as a colleague named
    // "Clear assignee".
    ...(assignedTo === null
      ? []
      : [
          { type: 'divider' as const },
          {
            label: m.inbox_assignee_clear(),
            icon: <UserRoundIcon className="size-4" />,
            onClick: () => onPick(null),
          },
        ]),
  ]
}
