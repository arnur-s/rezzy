import { m } from '@/paraglide/messages'
import { Dropdown, Label, Surface } from '@heroui/react'
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Channel } from '../types'
import { isChannelType } from '../types'
import { ChannelStatusBadge } from './channel-status-badge'
import { ChannelTypeIcon } from './channel-type-icon'
import { DeleteChannelDialog } from './delete-channel-dialog'
import { EditChannelNameModal } from './edit-channel-name-modal'

type Props = {
  channel: Channel
  workspaceId: string
}

export function ChannelCard({ channel, workspaceId }: Props) {
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const channelType = isChannelType(channel.type) ? channel.type : null

  const connectedLabel = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    return formatter.format(new Date(channel.created_at))
  }, [channel.created_at])

  return (
    <>
      <Surface
        className="flex items-center gap-4 rounded-2xl p-4 sm:p-5"
        variant="tertiary"
      >
        {channelType ? (
          <ChannelTypeIcon type={channelType} size="lg" />
        ) : (
          <span className="size-12 rounded-xl bg-muted" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold leading-tight">
              {channel.name?.trim() || m.channels_card_unnamed()}
            </h3>
            <ChannelStatusBadge isActive={channel.is_active} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {channelType
              ? m.channels_card_meta({
                  type: m[`channels_type_${channelType}_label`](),
                  date: connectedLabel,
                })
              : m.channels_card_meta_unknown({ date: connectedLabel })}
          </p>
        </div>

        <Dropdown>
          <Dropdown.Trigger>
            <MoreHorizontalIcon className="size-4" />
          </Dropdown.Trigger>

          <Dropdown.Popover className="min-w-44">
            <Dropdown.Menu
              onAction={(key) => {
                if (key === 'edit') setIsEditOpen(true)
                if (key === 'delete') setIsDeleteOpen(true)
              }}
            >
              <Dropdown.Item
                id="edit"
                textValue={m.channels_card_action_edit()}
              >
                <PencilIcon className="size-4" />
                <Label>{m.channels_card_action_edit()}</Label>
              </Dropdown.Item>
              <Dropdown.Item
                id="delete"
                textValue={m.channels_card_action_disconnect()}
                variant="danger"
              >
                <Trash2Icon className="size-4" />
                <Label>{m.channels_card_action_disconnect()}</Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </Surface>

      <EditChannelNameModal
        channel={channel}
        isOpen={isEditOpen}
        onOpenChange={setIsEditOpen}
        workspaceId={workspaceId}
      />

      <DeleteChannelDialog
        channel={channel}
        isOpen={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        workspaceId={workspaceId}
      />
    </>
  )
}
