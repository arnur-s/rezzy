import type { ChannelType } from '@/entities/channel'
import { isChannelType } from '@/entities/channel'
import {
  ConnectChannelComingSoon,
  ConnectChannelPicker,
  ConnectInstagramForm,
  ConnectTelegramForm,
  ConnectWhatsapp,
} from '@/features/channels/components'
import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeftIcon } from 'lucide-react'

type ChannelsNewSearch = {
  type?: ChannelType
}

export const Route = createFileRoute(
  '/_authenticated/workspaces/$id/settings/channels/new',
)({
  component: RouteComponent,
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
          label={m.channels_back_to_list()}
          variant="ghost"
          size="sm"
          icon={<ArrowLeftIcon className="size-4" />}
          onClick={goBackToList}
        />
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
        ) : type === 'instagram' ? (
          <ConnectInstagramForm
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
