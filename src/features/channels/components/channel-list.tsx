import { m } from '@/paraglide/messages'
import { Button, Skeleton, Surface } from '@heroui/react'
import { useNavigate } from '@tanstack/react-router'
import { PlugIcon, PlusIcon } from 'lucide-react'
import { useChannels } from '../hooks/use-channels'
import { ChannelCard } from './channel-card'

type Props = {
  workspaceId: string
}

export function ChannelList({ workspaceId }: Props) {
  const navigate = useNavigate()
  const channelsQuery = useChannels(workspaceId)

  function goToConnect() {
    void navigate({
      to: '/workspaces/$id/settings/channels/new',
      params: { id: workspaceId },
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">
            {m.channels_list_title()}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {m.channels_list_description()}
          </p>
        </div>
        <Button onPress={goToConnect} size="sm">
          <PlusIcon className="size-4" />
          <span>{m.channels_connect_cta()}</span>
        </Button>
      </header>

      {channelsQuery.isPending ? (
        <ChannelListSkeleton />
      ) : channelsQuery.isError ? (
        <ChannelListError onRetry={() => channelsQuery.refetch()} />
      ) : channelsQuery.data.length === 0 ? (
        <ChannelListEmpty onConnect={goToConnect} />
      ) : (
        <div className="flex flex-col gap-3">
          {channelsQuery.data.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              workspaceId={workspaceId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ChannelListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <Surface
          key={i}
          variant="tertiary"
          className="flex items-center gap-4 rounded-2xl p-5"
        >
          <Skeleton className="size-12 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3 rounded" />
            <Skeleton className="h-3 w-1/4 rounded" />
          </div>
          <Skeleton className="size-8 rounded-md" />
        </Surface>
      ))}
    </div>
  )
}

function ChannelListEmpty({ onConnect }: { onConnect: () => void }) {
  return (
    <Surface
      className="flex flex-col items-center gap-4 rounded-3xl px-6 py-14 text-center"
      variant="tertiary"
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <PlugIcon className="size-6" />
      </span>
      <div className="max-w-md space-y-1.5">
        <h3 className="text-base font-semibold">
          {m.channels_empty_title()}
        </h3>
        <p className="text-sm text-muted-foreground">
          {m.channels_empty_description()}
        </p>
      </div>
      <Button onPress={onConnect}>
        <PlusIcon className="size-4" />
        <span>{m.channels_empty_cta()}</span>
      </Button>
    </Surface>
  )
}

function ChannelListError({ onRetry }: { onRetry: () => void }) {
  return (
    <Surface
      className="flex flex-col items-center gap-3 rounded-2xl p-8 text-center"
      variant="tertiary"
    >
      <p className="text-sm text-danger">
        {m.channels_load_error_title()}
      </p>
      <Button size="sm" variant="secondary" onPress={onRetry}>
        {m.common_retry()}
      </Button>
    </Surface>
  )
}
