import type { ChannelType } from '@/entities/channel'
import { isChannelType } from '@/entities/channel'
import {
  ConnectChannelComingSoon,
  ConnectChannelPicker,
  ConnectTelegramForm,
  ConnectWhatsapp,
} from '@/features/channels/components'
import { m } from '@/paraglide/messages'
import { Button } from '@heroui/react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeftIcon } from 'lucide-react'

type ChannelsNewSearch = {
  type?: ChannelType
}

export const Route = createFileRoute(
  '/_authenticated/workspaces/$id/settings/channels/new',
)({
  component: RouteComponent,
  staticData: {
    crumb: (ctx) => [
      {
        label: m.breadcrumbs_channels(),
        link: {
          to: '/workspaces/$id/settings/channels',
          params: { id: ctx.params.id },
        },
      },
      { label: m.breadcrumbs_connect_channel() },
    ],
  },
  validateSearch: (search: Record<string, unknown>): ChannelsNewSearch => {
    const rawType = search.type
    if (typeof rawType === 'string' && isChannelType(rawType)) {
      return { type: rawType }
    }
    return {}
  },
})

function RouteComponent() {
  const { id } = Route.useParams()
  const { type } = Route.useSearch()
  const navigate = useNavigate()

  function clearType() {
    void navigate({
      to: '/workspaces/$id/settings/channels/new',
      params: { id },
      search: {},
    })
  }

  function setType(nextType: ChannelType) {
    void navigate({
      to: '/workspaces/$id/settings/channels/new',
      params: { id },
      search: { type: nextType },
    })
  }

  function goBackToList() {
    void navigate({
      to: '/workspaces/$id/settings/channels',
      params: { id },
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          onPress={goBackToList}
        >
          <ArrowLeftIcon className="size-4" />
          <span>{m.channels_back_to_list()}</span>
        </Button>
      </div>

      <div>
        {!type ? (
          <ConnectChannelPicker onSelect={setType} />
        ) : type === 'telegram' ? (
          <ConnectTelegramForm workspaceId={id} onCancel={clearType} />
        ) : type === 'whatsapp' ? (
          <ConnectWhatsapp
            target={{ kind: 'create', workspaceId: id }}
            onCancel={clearType}
          />
        ) : (
          <ConnectChannelComingSoon type={type} onCancel={clearType} />
        )}
      </div>
    </div>
  )
}
