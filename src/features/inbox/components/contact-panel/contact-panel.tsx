import {
  PLATFORM_META,
  PlatformIcon,
  isChannelType,
} from '@/entities/channel'
import { isConversationStatus } from '@/entities/conversation'
import type { ConversationWithRelations } from '@/entities/conversation'
import { m } from '@/paraglide/messages'
import { Avatar } from '@astryxdesign/core/Avatar'
import { Button } from '@astryxdesign/core/Button'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Skeleton } from '@astryxdesign/core/Skeleton'
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
  const status = isConversationStatus(conversation.status)
    ? conversation.status
    : 'open'

  return (
    <aside
      // bg-surface keeps the panel opaque when it renders as the tablet
      // overlay drawer; docked it matches the content sheet seamlessly.
      className="bg-surface flex h-full w-full min-w-0 flex-col overflow-hidden"
    >
      <header className="border-border/60 flex h-16 shrink-0 items-center justify-between border-b px-4">
        <h3 className="text-primary text-sm font-semibold">
          {m.inbox_contact_panel_title()}
        </h3>
        <IconButton
          variant="ghost"
          size="sm"
          onClick={onClose}
          label={m.inbox_contact_panel_close()}
          icon={<XIcon className="size-4" />}
        />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-6 px-4 py-5">
          {contactQuery.isError ? (
            <div className="bg-error/10 flex items-center justify-between gap-2 rounded-lg px-3 py-2">
              <span className="text-error text-sm">
                {m.inbox_contact_panel_load_error()}
              </span>
              <Button
                label={m.common_retry()}
                size="sm"
                variant="ghost"
                onClick={() => void contactQuery.refetch()}
                isLoading={contactQuery.isRefetching}
              />
            </div>
          ) : null}

          <div className="flex flex-col items-center text-center">
            <Avatar size="lg" name={contactName} />
            <p className="text-primary mt-3 text-base font-semibold">
              {contactName}
            </p>
            <p className="text-secondary mt-0.5 text-xs">
              {contactQuery.data?.phone ||
                conversation.contact.phone ||
                m.inbox_contact_panel_phone_empty()}
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-primary/70">
              {m.inbox_contact_panel_channels_label()}
            </p>
            {contactQuery.isPending ? (
              <Skeleton width="100%" height={32} radius={3} />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {channelTypes.length === 0 ? (
                  <span className="text-secondary text-xs">—</span>
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
            <Skeleton width="100%" height={96} radius={3} />
          )}
        </div>
      </div>
    </aside>
  )
}
