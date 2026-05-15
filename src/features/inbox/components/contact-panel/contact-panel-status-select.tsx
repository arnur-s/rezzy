import {
  CONVERSATION_STATUSES,
  CONVERSATION_STATUS_META,
  isConversationStatus,
} from '@/entities/conversation'
import type { ConversationStatus } from '@/entities/conversation'
import { m } from '@/paraglide/messages'
import { Label, ListBox, Select, toast } from '@heroui/react'
import { useUpdateConversationStatus } from '../../hooks/use-conversations'

type Props = {
  workspaceId: string
  conversationId: string
  value: ConversationStatus
}

export function ContactPanelStatusSelect({
  workspaceId,
  conversationId,
  value,
}: Props) {
  const updateStatus = useUpdateConversationStatus(workspaceId)

  function handleChange(next: unknown) {
    if (typeof next !== 'string' || !isConversationStatus(next)) return
    if (next === value) return
    updateStatus.mutate(
      { conversationId, status: next },
      {
        onError: (error) => {
          toast.danger(m.inbox_contact_panel_status_save_error(), {
            description:
              error instanceof Error ? error.message : m.common_unknown_error(),
          })
        },
      },
    )
  }

  return (
    <Select
      value={value}
      onChange={handleChange}
      variant="secondary"
      className="w-full"
    >
      <Label className="text-xs font-medium text-foreground/70">
        {m.inbox_contact_panel_status_label()}
      </Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {CONVERSATION_STATUSES.map((status) => (
            <ListBox.Item
              key={status}
              id={status}
              textValue={CONVERSATION_STATUS_META[status].labelKey()}
            >
              {CONVERSATION_STATUS_META[status].labelKey()}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}
