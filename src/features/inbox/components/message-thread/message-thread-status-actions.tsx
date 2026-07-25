import type { ConversationStatus } from '@/entities/conversation'
import { isConversationStatus } from '@/entities/conversation'
import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu'
import type { DropdownMenuOption } from '@astryxdesign/core/DropdownMenu'
import { useToast } from '@astryxdesign/core/Toast'
import {
  CheckCircle2Icon,
  ClockIcon,
  InboxIcon,
  MoreVerticalIcon,
} from 'lucide-react'
import { useUpdateConversationStatus } from '../../hooks/use-conversations'

type Props = {
  workspaceId: string
  conversationId: string
  status: string
}

/**
 * Routing the conversation is half the core loop ("reply or route them"), so
 * the primary status action lives in the thread header rather than only behind
 * the contact panel. One dominant action is shown — Close while open, Reopen
 * otherwise — with the less-common Snooze tucked into an overflow menu.
 */
export function MessageThreadStatusActions({
  workspaceId,
  conversationId,
  status,
}: Props) {
  const showToast = useToast()
  const updateStatus = useUpdateConversationStatus(workspaceId)
  const current: ConversationStatus = isConversationStatus(status)
    ? status
    : 'open'

  function apply(next: ConversationStatus) {
    if (next === current || updateStatus.isPending) return
    updateStatus.mutate(
      { conversationId, status: next },
      {
        onError: (error) => {
          showToast({
            body:
              error instanceof Error ? error.message : m.common_unknown_error(),
            type: 'error',
          })
        },
      },
    )
  }

  if (current !== 'open') {
    return (
      <Button
        label={m.inbox_thread_action_reopen()}
        size="sm"
        variant="secondary"
        icon={<InboxIcon className="size-4" />}
        onClick={() => apply('open')}
        isDisabled={updateStatus.isPending}
      />
    )
  }

  const menuItems: Array<DropdownMenuOption> = [
    {
      label: m.inbox_thread_action_snooze(),
      icon: <ClockIcon className="size-4" />,
      onClick: () => apply('snoozed'),
    },
  ]

  return (
    <div className="flex items-center gap-1">
      <Button
        label={m.inbox_thread_action_close()}
        size="sm"
        variant="secondary"
        icon={<CheckCircle2Icon className="size-4" />}
        onClick={() => apply('closed')}
        isDisabled={updateStatus.isPending}
      />
      <DropdownMenu
        hasChevron={false}
        menuWidth={160}
        button={{
          label: m.inbox_thread_more_actions(),
          icon: <MoreVerticalIcon className="size-4" />,
          isIconOnly: true,
          variant: 'ghost',
        }}
        items={menuItems}
      />
    </div>
  )
}
