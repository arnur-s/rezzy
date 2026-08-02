import {
  ContactStatusChip,
  contactDisplayName,
  isContactStatus,
} from '@/entities/contact'
import { ContactNotesSection } from '@/features/contact-notes'
import { useWorkspaceMemberDirectory } from '@/features/workspaces/hooks/use-workspaces'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { formatDate } from '@/lib/format-date'
import { CONTACT_DATE_FORMAT } from '../model/date-format'
import { m } from '@/paraglide/messages'
import { Avatar } from '@astryxdesign/core/Avatar'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Skeleton } from '@astryxdesign/core/Skeleton'
import { useToast } from '@astryxdesign/core/Toast'
import { Link } from '@tanstack/react-router'
import { ArrowLeftIcon, CopyIcon, UserRoundXIcon } from 'lucide-react'
import { useState } from 'react'
import {
  useContactConversations,
  useContactDetail,
  useContactPhones,
} from '../hooks/use-contacts'
import { ContactFormDialog } from './contact-form-dialog'

type Props = {
  workspaceId: string
  contactId: string
}

function CopyableField({
  label,
  value,
  copyLabel,
}: {
  label: string
  value: string
  copyLabel: string
}) {
  const showToast = useToast()

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-secondary text-xs">{label}</p>
        <p className="text-primary truncate text-base">{value}</p>
      </div>
      <IconButton
        variant="ghost"
        size="sm"
        label={copyLabel}
        icon={<CopyIcon className="size-4" />}
        onClick={() => {
          void copyToClipboard(value).then((ok) =>
            showToast({
              body: ok
                ? m.contact_detail_copied()
                : m.contact_detail_copy_failed(),
              type: ok ? 'info' : 'error',
            }),
          )
        }}
      />
    </div>
  )
}

export function ContactDetailPage({ workspaceId, contactId }: Props) {
  const contactQuery = useContactDetail(workspaceId, contactId)
  const conversationsQuery = useContactConversations(workspaceId, contactId)
  const phonesQuery = useContactPhones(workspaceId, contactId)
  const membersQuery = useWorkspaceMemberDirectory(workspaceId)
  const [isEditOpen, setIsEditOpen] = useState(false)

  const backLink = (
    <Link
      to="/workspaces/$id/contacts"
      params={{ id: workspaceId }}
      className="text-secondary hover:text-primary focus-visible:ring-accent inline-flex items-center gap-1.5 rounded-md text-xs focus-visible:ring-2 focus-visible:outline-none"
    >
      <ArrowLeftIcon className="size-3.5" aria-hidden />
      {m.contact_detail_back()}
    </Link>
  )

  if (contactQuery.isPending) {
    return (
      <div className="flex h-full flex-col">
        <header className="border-border flex h-16 shrink-0 items-center border-b px-4">
          {backLink}
        </header>
        <div className="flex flex-col gap-3 p-4">
          <Skeleton width={180} height={20} radius={3} />
          <Skeleton width="100%" height={96} radius={3} />
        </div>
      </div>
    )
  }

  if (contactQuery.isError) {
    return (
      <div className="flex h-full flex-col">
        <header className="border-border flex h-16 shrink-0 items-center border-b px-4">
          {backLink}
        </header>
        <div className="flex h-full items-center justify-center p-6">
          <EmptyState
            icon={<UserRoundXIcon className="text-secondary size-8" />}
            title={m.contact_detail_load_error()}
            actions={
              <Button
                label={m.common_retry()}
                variant="secondary"
                onClick={() => void contactQuery.refetch()}
                isLoading={contactQuery.isRefetching}
              />
            }
          />
        </div>
      </div>
    )
  }

  const contact = contactQuery.data

  // `getWorkspaceContact` filters on workspace_id as well as id, so a contact
  // belonging to another workspace resolves to null here rather than rendering
  // inside the wrong workspace's shell.
  if (!contact) {
    return (
      <div className="flex h-full flex-col">
        <header className="border-border flex h-16 shrink-0 items-center border-b px-4">
          {backLink}
        </header>
        <div className="flex h-full items-center justify-center p-6">
          <EmptyState
            icon={<UserRoundXIcon className="text-secondary size-8" />}
            title={m.contact_detail_not_found_title()}
            description={m.contact_detail_not_found_description()}
          />
        </div>
      </div>
    )
  }

  const displayName = contactDisplayName(contact)
  const ownerName = contact.owner_id
    ? ((membersQuery.data ?? []).find((member) => member.userId === contact.owner_id)
        ?.fullName ?? null)
    : null
  const conversations = conversationsQuery.data ?? []
  const loadedPhones = (phonesQuery.data ?? [])
    .map((entry) => entry.phone.trim())
    .filter((phone) => phone !== '')
  const phoneRows =
    loadedPhones.length > 0
      ? loadedPhones
      : contact.phone?.trim()
        ? [contact.phone.trim()]
        : []
  const isIncomplete = phoneRows.length === 0 && !contact.email?.trim()

  return (
    <div className="flex h-full w-full min-h-0 flex-col overflow-hidden">
      <header className="border-border flex h-16 shrink-0 items-center justify-between gap-3 border-b px-4">
        {backLink}
        <Button
          label={m.contact_detail_edit()}
          size="sm"
          variant="secondary"
          onClick={() => setIsEditOpen(true)}
        />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-8">
          {/* Identity */}
          <div className="flex items-start gap-4">
            <Avatar
              size="lg"
              name={displayName}
              src={contact.avatar_url ?? undefined}
            />
            <div className="min-w-0 flex-1">
              <h1 className="text-primary truncate text-base font-semibold">
                {displayName}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {isContactStatus(contact.status) ? (
                  <ContactStatusChip status={contact.status} />
                ) : null}
                <span className="text-secondary text-xs">
                  {m.contact_detail_owner()}:{' '}
                  {ownerName ?? m.contact_detail_unassigned()}
                </span>
                <span className="text-secondary text-xs">
                  {m.contact_detail_last_seen()}:{' '}
                  {contact.last_seen_at
                    ? formatDate(contact.last_seen_at, CONTACT_DATE_FORMAT)
                    : m.contacts_never_contacted()}
                </span>
              </div>
            </div>
          </div>

          {/* Contact information — only fields that exist, never empty rows. */}
          <section className="flex flex-col gap-1">
            <h2 className="text-primary text-xs font-semibold">
              {m.contact_detail_information()}
            </h2>
            <div className="divide-border divide-y">
              {/* Every number, primary first. The list falls back to the
                primary alone while the set is loading (or if it fails), so the
                field never disappears from under the reader. */}
              {phoneRows.map((phone, index) => (
                <CopyableField
                  key={phone}
                  label={
                    index === 0
                      ? m.contact_detail_phone()
                      : m.contact_form_phone_additional({
                          number: String(index + 1),
                        })
                  }
                  value={phone}
                  copyLabel={m.contact_detail_copy_phone()}
                />
              ))}
              {contact.email?.trim() ? (
                <CopyableField
                  label={m.contact_detail_email()}
                  value={contact.email.trim()}
                  copyLabel={m.contact_detail_copy_email()}
                />
              ) : null}
              {contact.contact_channels.length > 0 ? (
                <div className="py-2">
                  <p className="text-secondary text-xs">
                    {m.contact_detail_channels()}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {contact.contact_channels.map((channel) => (
                      <span
                        key={channel.id}
                        className="border-border rounded-lg border px-2 py-1 text-xs"
                      >
                        {channel.external_name?.trim() || channel.channel_type}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {contact.tags.length > 0 ? (
                <div className="py-2">
                  <p className="text-secondary text-xs">
                    {m.contact_detail_tags()}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {contact.tags.map((tag) => (
                      <span
                        key={tag}
                        className="border-border rounded-lg border px-2 py-1 text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            {/* One restrained prompt instead of a row per missing field. */}
            {isIncomplete ? (
              <p className="text-secondary mt-1 text-xs">
                {m.contact_detail_incomplete()}
              </p>
            ) : null}
          </section>

          {/* Notes. ContactNotesSection carries aria-labelledby="contact-notes-title"
              but renders no heading of its own, so the consumer owns it. */}
          <section className="flex flex-col gap-2">
            <h2
              id="contact-notes-title"
              className="text-primary text-xs font-semibold"
            >
              {m.contact_detail_notes()}
            </h2>
            <ContactNotesSection
              workspaceId={workspaceId}
              contactId={contact.id}
            />
          </section>

          {/* Recent conversations */}
          <section className="flex flex-col gap-2">
            <h2 className="text-primary text-xs font-semibold">
              {m.contact_detail_conversations()}
            </h2>
            {conversationsQuery.isPending ? (
              <Skeleton width="100%" height={64} radius={3} />
            ) : conversations.length === 0 ? (
              <p className="text-secondary text-xs">
                {m.contact_detail_no_conversations()}
              </p>
            ) : (
              <ul className="divide-border border-border divide-y border-y">
                {conversations.map((conversation) => (
                  <li key={conversation.id}>
                    <Link
                      to="/workspaces/$id/inbox/$conversationId"
                      params={{
                        id: workspaceId,
                        conversationId: conversation.id,
                      }}
                      className="hover:bg-primary/4 focus-visible:ring-accent flex flex-col gap-0.5 rounded-md px-2 py-3 focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-primary text-xs font-medium">
                          {conversation.channel.name?.trim() ||
                            conversation.channel.type}
                        </span>
                        {!conversation.channel.is_active ? (
                          <span className="text-secondary text-xs">
                            {m.contact_detail_channel_disconnected()}
                          </span>
                        ) : null}
                        <span className="text-secondary ml-auto text-xs">
                          {conversation.last_message_at
                            ? formatDate(
                                conversation.last_message_at,
                                CONTACT_DATE_FORMAT,
                              )
                            : ''}
                        </span>
                      </span>
                      {conversation.last_message_preview ? (
                        <span className="text-secondary truncate text-xs">
                          {conversation.last_message_preview}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="text-secondary flex flex-wrap gap-4 text-xs">
            <span>
              {m.contact_detail_created()}:{' '}
              {formatDate(contact.created_at, CONTACT_DATE_FORMAT)}
            </span>
            <span>
              {m.contact_detail_updated()}:{' '}
              {formatDate(contact.updated_at, CONTACT_DATE_FORMAT)}
            </span>
          </section>
        </div>
      </div>

      <ContactFormDialog
        workspaceId={workspaceId}
        contact={contact}
        isOpen={isEditOpen}
        onOpenChange={setIsEditOpen}
      />
    </div>
  )
}
