import { m } from '@/paraglide/messages'
import { Button, Skeleton } from '@heroui/react'
import { PlugIcon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { useChannels } from '../hooks/use-channels'
import { ChannelCard } from './channel-card'
import { ConnectChannelModal } from './connect-channel-modal'

type Props = {
  workspaceId: string
}

export function ChannelList({ workspaceId }: Props) {
  const channelsQuery = useChannels(workspaceId)
  const [isConnectOpen, setIsConnectOpen] = useState(false)

  function openConnect() {
    setIsConnectOpen(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{m.channels_list_title()}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {m.channels_list_description()}
          </p>
        </div>
        <Button onPress={openConnect} size="sm">
          <PlusIcon className="size-4" />
          <span>{m.channels_connect_cta()}</span>
        </Button>
      </header>

      {channelsQuery.isPending ? (
        <ChannelListSkeleton />
      ) : channelsQuery.isError ? (
        <ChannelListError onRetry={() => channelsQuery.refetch()} />
      ) : channelsQuery.data.length === 0 ? (
        <ChannelListEmpty onConnect={openConnect} />
      ) : (
        <div className="divide-y divide-border/60 border-y border-border/60">
          {channelsQuery.data.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              workspaceId={workspaceId}
            />
          ))}
        </div>
      )}

      <ConnectChannelModal
        workspaceId={workspaceId}
        isOpen={isConnectOpen}
        onOpenChange={setIsConnectOpen}
      />
    </div>
  )
}

function ChannelListSkeleton() {
  return (
    <div className="divide-y divide-border/60 border-y border-border/60">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4 py-4">
          <Skeleton className="size-12 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3 rounded" />
            <Skeleton className="h-3 w-1/4 rounded" />
          </div>
          <Skeleton className="size-8 rounded-md" />
        </div>
      ))}
    </div>
  )
}

function ChannelListEmpty({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 border-y border-border/60 px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <PlugIcon className="size-6" />
      </span>
      <div className="max-w-md space-y-1.5">
        <h3 className="text-base font-semibold">{m.channels_empty_title()}</h3>
        <p className="text-sm text-muted-foreground">
          {m.channels_empty_description()}
        </p>
      </div>
      <Button onPress={onConnect}>
        <PlusIcon className="size-4" />
        <span>{m.channels_empty_cta()}</span>
      </Button>
    </div>
  )
}

function ChannelListError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 border-y border-border/60 px-6 py-10 text-center">
      <p className="text-sm text-danger">{m.channels_load_error_title()}</p>
      <Button size="sm" variant="secondary" onPress={onRetry}>
        {m.common_retry()}
      </Button>
    </div>
  )
}
