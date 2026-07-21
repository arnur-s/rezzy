import type { Channel } from '@/entities/channel'
import {
  ChannelStatusBadge,
  ChannelTypeIcon,
  isChannelType,
} from '@/entities/channel'
import { m } from '@/paraglide/messages'
import { Dropdown, Label } from '@heroui/react'
import {
  CircleCheckIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RefreshCwIcon,
  Trash2Icon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { ActivateChannelDialog } from './activate-channel-dialog'
import { DeactivateChannelDialog } from './deactivate-channel-dialog'
import { EditChannelNameModal } from './edit-channel-name-modal'
import { ReconnectWhatsappModal } from './reconnect-whatsapp-modal'

type Props = {
  channel: Channel
  workspaceId: string
}

export function ChannelCard({ channel, workspaceId }: Props) {
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isActivateOpen, setIsActivateOpen] = useState(false)
  const [isReconnectOpen, setIsReconnectOpen] = useState(false)

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
      <div className="flex min-h-20 items-center gap-4 py-4">
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
          <p className="mt-1 text-xs text-muted">
            {channelType
              ? m.channels_card_meta({
                  type: m[`channels_type_${channelType}_label`](),
                  date: connectedLabel,
                })
              : m.channels_card_meta_unknown({ date: connectedLabel })}
          </p>
        </div>

        <Dropdown>
          <Dropdown.Trigger aria-label={m.channels_card_actions_label()}>
            <MoreHorizontalIcon className="size-4" />
          </Dropdown.Trigger>

          <Dropdown.Popover className="min-w-44">
            <Dropdown.Menu
              onAction={(key) => {
                if (key === 'edit') setIsEditOpen(true)
                if (key === 'reconnect') setIsReconnectOpen(true)
                if (key === 'disconnect') setIsDeleteOpen(true)
                if (key === 'activate') setIsActivateOpen(true)
              }}
            >
              <Dropdown.Item
                id="edit"
                textValue={m.channels_card_action_edit()}
              >
                <PencilIcon className="size-4" />
                <Label>{m.channels_card_action_edit()}</Label>
              </Dropdown.Item>
              {channelType === 'whatsapp' && (
                <Dropdown.Item
                  id="reconnect"
                  textValue={m.channels_card_action_reconnect()}
                >
                  <RefreshCwIcon className="size-4" />
                  <Label>{m.channels_card_action_reconnect()}</Label>
                </Dropdown.Item>
              )}
              {channel.is_active ? (
                <Dropdown.Item
                  id="disconnect"
                  textValue={m.channels_card_action_disconnect()}
                  variant="danger"
                >
                  <Trash2Icon className="size-4" />
                  <Label>{m.channels_card_action_disconnect()}</Label>
                </Dropdown.Item>
              ) : (
                <Dropdown.Item
                  id="activate"
                  textValue={m.channels_card_action_activate()}
                >
                  <CircleCheckIcon className="size-4" />
                  <Label>{m.channels_card_action_activate()}</Label>
                </Dropdown.Item>
              )}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>

      <EditChannelNameModal
        channel={channel}
        isOpen={isEditOpen}
        onOpenChange={setIsEditOpen}
        workspaceId={workspaceId}
      />

      {channelType === 'whatsapp' && (
        <ReconnectWhatsappModal
          channel={channel}
          isOpen={isReconnectOpen}
          onOpenChange={setIsReconnectOpen}
          workspaceId={workspaceId}
        />
      )}

      <DeactivateChannelDialog
        channel={channel}
        isOpen={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        workspaceId={workspaceId}
      />

      <ActivateChannelDialog
        channel={channel}
        isOpen={isActivateOpen}
        onOpenChange={setIsActivateOpen}
        workspaceId={workspaceId}
      />
    </>
  )
}
