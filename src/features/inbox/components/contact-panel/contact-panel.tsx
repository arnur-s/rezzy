import { PLATFORM_META, PlatformIcon, isChannelType } from '@/entities/channel'
import {
  CONTACT_SOURCE_META,
  ContactStatusChip,
  isContactSource,
  isContactStatus,
} from '@/entities/contact'
import type { ConversationWithRelations } from '@/entities/conversation'
import { isConversationStatus } from '@/entities/conversation'
import { ContactNotesSection } from '@/features/contact-notes'
import { useContactPhones } from '@/features/contacts/hooks/use-contacts'
import { CONTACT_DATE_FORMAT } from '@/features/contacts/model/date-format'
import { useWorkspaceMemberLookup } from '@/features/workspaces/hooks/use-workspaces'
import { formatDate } from '@/lib/format-date'
import { m } from '@/paraglide/messages'
import { Avatar } from '@astryxdesign/core/Avatar'
import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { IconButton } from '@astryxdesign/core/IconButton'
import {
  MetadataList,
  MetadataListItem,
} from '@astryxdesign/core/MetadataList'
import { Skeleton } from '@astryxdesign/core/Skeleton'
import { XIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useContact } from '../../hooks/use-contact'
import { ContactPanelStatusSelect } from './contact-panel-status-select'

type Props = {
  workspaceId: string
  conversation: ConversationWithRelations
  onClose: () => void
}

/**
 * Labels above values, not beside them. MetadataList defaults a single column
 * to `position: 'start'`, which assumes a short label; the base locale's are
 * not ("Ответственный", "Активность"), and the panel is 320px docked and
 * narrower again as the tablet sheet.
 */
const LABEL_CONFIG = { position: 'top' } as const

export function ContactPanel({ workspaceId, conversation, onClose }: Props) {
  const contactQuery = useContact(conversation.contact.id)
  const phonesQuery = useContactPhones(workspaceId, conversation.contact.id)
  // `isLoaded` distinguishes "this owner has left the workspace" from "the
  // roster has not arrived", which the owner row has to render differently.
  const { lookup: memberLookup, isLoaded: isRosterLoaded } =
    useWorkspaceMemberLookup(workspaceId)

  const contact = contactQuery.data

  /**
   * Every channel this person is reachable on, the conversation's own included
   * so the panel is never missing the one the agent is looking at. External
   * names collapse under their type — a contact can hold more than one handle
   * on the same platform.
   */
  const channelEntries = useMemo(() => {
    const byType = new Map<string, { type: string; names: Array<string> }>()

    const add = (type: string, externalName?: string | null) => {
      const entry = byType.get(type) ?? { type, names: [] }
      const name = externalName?.trim()
      if (name && !entry.names.includes(name)) {
        entry.names.push(name)
      }
      byType.set(type, entry)
    }

    add(conversation.channel.type)
    for (const channel of contact?.contact_channels ?? []) {
      add(channel.channel_type, channel.external_name)
    }

    return Array.from(byType.values())
  }, [contact, conversation.channel.type])

  const contactName =
    contact?.name?.trim() || conversation.contact.name?.trim() || '—'
  const status = isConversationStatus(conversation.status)
    ? conversation.status
    : 'open'

  // Same precedence as the name: the freshly loaded contact first, then
  // whatever the conversation row already carried, so the picture is on screen
  // from the first paint rather than appearing a beat later.
  const contactAvatarUrl =
    contact?.avatar_url ?? conversation.contact.avatar_url ?? undefined

  /**
   * `contact_phones` is the complete set, `contacts.phone` its primary. The
   * primary alone stands in while the set is loading or fails, so the field
   * never disappears from under the reader.
   */
  const loadedPhones = (phonesQuery.data ?? [])
    .map((entry) => entry.phone.trim())
    .filter((phone) => phone !== '')
  const primaryPhone =
    contact?.phone?.trim() || conversation.contact.phone?.trim() || ''
  const phones =
    loadedPhones.length > 0 ? loadedPhones : primaryPhone ? [primaryPhone] : []

  const email = contact?.email?.trim() ?? ''
  const tags = contact?.tags ?? []
  const source = contact?.source?.trim() ?? ''
  const sourceLabel = isContactSource(source)
    ? CONTACT_SOURCE_META[source].labelKey()
    : source
  const ownerName = contact?.owner_id
    ? (memberLookup.get(contact.owner_id)?.fullName ?? null)
    : null

  return (
    <aside
      // bg-surface keeps the panel opaque when it renders as the tablet
      // overlay drawer; docked it matches the content sheet seamlessly.
      className="bg-surface flex h-full w-full min-w-0 flex-col overflow-hidden"
    >
      <header className="border-border flex h-14 shrink-0 items-center justify-between border-b px-4">
        <h3 className="text-primary font-semibold">
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
            <Avatar size="lg" name={contactName} src={contactAvatarUrl} />
            <p className="text-primary mt-3 text-base font-semibold">
              {contactName}
            </p>
            {contact && isContactStatus(contact.status) ? (
              <ContactStatusChip status={contact.status} className="mt-2" />
            ) : null}
          </div>

          {/* Everything the record holds, minus the parts that are plumbing:
              the row's own id, its workspace, and the soft-delete stamp say
              nothing to an agent reading a conversation. Missing fields are
              omitted rather than rendered empty — an "Email: —" row is a line
              of furniture that answers nothing. */}
          {contactQuery.isPending ? (
            <Skeleton width="100%" height={140} radius={3} />
          ) : (
            <MetadataList
              title={m.contact_detail_information()}
              label={LABEL_CONFIG}
            >
              {phones.map((phone, index) => (
                <MetadataListItem
                  key={phone}
                  label={
                    index === 0
                      ? m.contact_detail_phone()
                      : m.contact_form_phone_additional({
                          number: String(index + 1),
                        })
                  }
                >
                  {phone}
                </MetadataListItem>
              ))}

              {email ? (
                <MetadataListItem label={m.contact_detail_email()}>
                  {email}
                </MetadataListItem>
              ) : null}

              {sourceLabel ? (
                <MetadataListItem label={m.contact_detail_source()}>
                  {sourceLabel}
                </MetadataListItem>
              ) : null}

              <MetadataListItem label={m.contact_detail_owner()}>
                {/* A roster still in flight is not the same answer as "nobody
                    owns this", so it says nothing until it knows. */}
                {contact?.owner_id && !isRosterLoaded
                  ? ''
                  : (ownerName ?? m.contact_detail_unassigned())}
              </MetadataListItem>

              <MetadataListItem label={m.contact_detail_channels()}>
                {channelEntries.length === 0 ? (
                  '—'
                ) : (
                  <span className="flex flex-wrap gap-1.5">
                    {channelEntries.map((entry) => (
                      <Badge
                        key={entry.type}
                        variant="neutral"
                        icon={
                          isChannelType(entry.type) ? (
                            <PlatformIcon type={entry.type} size="sm" />
                          ) : undefined
                        }
                        label={
                          <>
                            {isChannelType(entry.type)
                              ? PLATFORM_META[entry.type].labelKey()
                              : entry.type}
                            {entry.names.length > 0
                              ? ` · ${entry.names.join(', ')}`
                              : null}
                          </>
                        }
                      />
                    ))}
                  </span>
                )}
              </MetadataListItem>

              {tags.length > 0 ? (
                <MetadataListItem label={m.contact_detail_tags()}>
                  <span className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="neutral" label={tag} />
                    ))}
                  </span>
                </MetadataListItem>
              ) : null}

              <MetadataListItem label={m.contact_detail_last_seen()}>
                {contact?.last_seen_at
                  ? formatDate(contact.last_seen_at, CONTACT_DATE_FORMAT)
                  : m.contacts_never_contacted()}
              </MetadataListItem>

              {contact ? (
                <MetadataListItem label={m.contact_detail_created()}>
                  {formatDate(contact.created_at, CONTACT_DATE_FORMAT)}
                </MetadataListItem>
              ) : null}

              {contact ? (
                <MetadataListItem label={m.contact_detail_updated()}>
                  {formatDate(contact.updated_at, CONTACT_DATE_FORMAT)}
                </MetadataListItem>
              ) : null}
            </MetadataList>
          )}

          <ContactPanelStatusSelect
            workspaceId={workspaceId}
            conversationId={conversation.id}
            value={status}
          />

          {contact ? (
            <ContactNotesSection
              workspaceId={workspaceId}
              contactId={contact.id}
            />
          ) : (
            <Skeleton width="100%" height={96} radius={3} />
          )}
        </div>
      </div>
    </aside>
  )
}
