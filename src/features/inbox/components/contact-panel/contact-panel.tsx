import {
  PLATFORM_META,
  PlatformIcon,
  isChannelType,
} from '@/entities/channel'
import { isConversationStatus } from '@/entities/conversation'
import type { ConversationWithRelations } from '@/entities/conversation'
import { getUserInitials } from '@/entities/user'
import { useRecordContactVisit } from '@/features/dashboard/hooks/use-record-recent-visit'
import { m } from '@/paraglide/messages'
import { Avatar, Button, ScrollShadow, Skeleton } from '@heroui/react'
import { XIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useContact } from '../../hooks/use-contact'
import { ContactPanelNotes } from './contact-panel-notes'
import { ContactPanelQuickActions } from './contact-panel-quick-actions'
import { ContactPanelStatusSelect } from './contact-panel-status-select'

type Props = {
  workspaceId: string
  conversation: ConversationWithRelations
  onClose: () => void
}

export function ContactPanel({ workspaceId, conversation, onClose }: Props) {
  const contactQuery = useContact(conversation.contact.id)

  const channelTypes = useMemo(() => {
    const types = new Set<string>()
    types.add(conversation.channel.type)
    for (const cc of contactQuery.data?.contact_channels ?? []) {
      types.add(cc.channel_type)
    }
    return Array.from(types).filter(isChannelType)
  }, [contactQuery.data, conversation.channel.type])

  const contactName =
    contactQuery.data?.name?.trim() || conversation.contact.name?.trim() || '—'
  const initials = getUserInitials(contactName)
  const status = isConversationStatus(conversation.status)
    ? conversation.status
    : 'open'

  useRecordContactVisit(
    conversation.contact.id,
    contactName !== '—' ? contactName : undefined,
    workspaceId,
  )

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-border/60">
      <header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">
          {m.inbox_contact_panel_title()}
        </h3>
        <Button
          variant="ghost"
          isIconOnly
          size="sm"
          onPress={onClose}
          aria-label={m.inbox_contact_panel_close()}
        >
          <XIcon className="size-4" />
        </Button>
      </header>

      <ScrollShadow className="min-h-0 flex-1">
        <div className="flex flex-col gap-6 px-4 py-5">
          <div className="flex flex-col items-center text-center">
            <Avatar size="lg" className="size-16">
              <Avatar.Fallback className="text-base">
                {initials}
              </Avatar.Fallback>
            </Avatar>
            <p className="mt-3 text-base font-semibold text-foreground">
              {contactName}
            </p>
            <p className="mt-0.5 text-xs text-foreground/55">
              {contactQuery.data?.phone ||
                conversation.contact.phone ||
                m.inbox_contact_panel_phone_empty()}
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-foreground/70">
              {m.inbox_contact_panel_channels_label()}
            </p>
            {contactQuery.isPending ? (
              <Skeleton className="h-8 w-full rounded-lg" />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {channelTypes.length === 0 ? (
                  <span className="text-xs text-foreground/55">—</span>
                ) : (
                  channelTypes.map((type) => (
                    <span
                      key={type}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-2 py-1 text-xs"
                    >
                      <PlatformIcon type={type} size="sm" />
                      {PLATFORM_META[type].labelKey()}
                    </span>
                  ))
                )}
              </div>
            )}
          </div>

          <ContactPanelStatusSelect
            workspaceId={workspaceId}
            conversationId={conversation.id}
            value={status}
          />

          <ContactPanelQuickActions
            workspaceId={workspaceId}
            conversationId={conversation.id}
            currentStatus={status}
          />

          {contactQuery.data ? (
            <ContactPanelNotes
              contactId={contactQuery.data.id}
              initialNotes={contactQuery.data.notes ?? ''}
            />
          ) : (
            <Skeleton className="h-24 w-full rounded-md" />
          )}
        </div>
      </ScrollShadow>
    </aside>
  )
}
