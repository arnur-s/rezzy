import {
  CONVERSATION_STATUSES,
  CONVERSATION_STATUS_META,
  isConversationStatus,
} from '@/entities/conversation'
import type { ConversationStatus } from '@/entities/conversation'
import { m } from '@/paraglide/messages'
import { Selector } from '@astryxdesign/core/Selector'
import { useToast } from '@astryxdesign/core/Toast'
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
  const showToast = useToast()
  const updateStatus = useUpdateConversationStatus(workspaceId)

  function handleChange(next: string) {
    if (!isConversationStatus(next)) return
    if (next === value) return
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

  return (
    <Selector
      label={m.inbox_contact_panel_status_label()}
      value={value}
      onChange={handleChange}
      options={CONVERSATION_STATUSES.map((status) => ({
        value: status,
        label: CONVERSATION_STATUS_META[status].labelKey(),
      }))}
    />
  )
}
