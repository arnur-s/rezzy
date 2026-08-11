import type { Channel } from '@/entities/channel'
import {
  ChannelStatusBadge,
  ChannelTypeIcon,
  isChannelType,
} from '@/entities/channel'
import { formatDate } from '@/lib/format-date'
import { m } from '@/paraglide/messages'
import type { DropdownMenuOption } from '@astryxdesign/core/DropdownMenu'
import { MoreMenu } from '@astryxdesign/core/MoreMenu'
import {
  CircleCheckIcon,
  PencilIcon,
  RefreshCwIcon,
  Trash2Icon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { ActivateChannelDialog } from './activate-channel-dialog'
import { DeactivateChannelDialog } from './deactivate-channel-dialog'
import { EditChannelNameModal } from './edit-channel-name-modal'
import { ReconnectInstagramModal } from './reconnect-instagram-modal'
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

  const connectedLabel = useMemo(
    () =>
      formatDate(channel.created_at, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    [channel.created_at],
  )

  const menuItems: Array<DropdownMenuOption> = [
    {
      label: m.channels_card_action_edit(),
      icon: <PencilIcon className="size-4" />,
      onClick: () => setIsEditOpen(true),
    },
    ...(channelType === 'whatsapp' || channelType === 'instagram'
      ? [
          {
            label: m.channels_card_action_reconnect(),
            icon: <RefreshCwIcon className="size-4" />,
            onClick: () => setIsReconnectOpen(true),
          },
        ]
      : []),
    channel.is_active
      ? {
          label: m.channels_card_action_disconnect(),
          icon: <Trash2Icon className="size-4" />,
          onClick: () => setIsDeleteOpen(true),
        }
      : {
          label: m.channels_card_action_activate(),
          icon: <CircleCheckIcon className="size-4" />,
          onClick: () => setIsActivateOpen(true),
        },
  ]

  return (
    <>
      <div className="flex min-h-20 items-center gap-4 py-4">
        {channelType ? (
          <ChannelTypeIcon type={channelType} size="lg" />
        ) : (
          <span className="bg-muted size-12 rounded-xl" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base leading-tight font-semibold">
              {channel.name?.trim() || m.channels_card_unnamed()}
            </h3>
            <ChannelStatusBadge isActive={channel.is_active} />
          </div>
          <p className="text-secondary mt-1 text-xs">
            {channelType
              ? m.channels_card_meta({
                  type: m[`channels_type_${channelType}_label`](),
                  date: connectedLabel,
                })
              : m.channels_card_meta_unknown({ date: connectedLabel })}
          </p>
        </div>

        <MoreMenu label={m.channels_card_actions_label()} items={menuItems} />
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

      {channelType === 'instagram' && (
        <ReconnectInstagramModal
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
