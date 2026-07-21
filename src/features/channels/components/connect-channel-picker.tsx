import type { ChannelType } from '@/entities/channel'
import { CHANNEL_META, ChannelTypeIcon } from '@/entities/channel'
import { m } from '@/paraglide/messages'
import { Chip } from '@heroui/react'
import { ChevronRightIcon } from 'lucide-react'

type Props = {
  onSelect: (type: ChannelType) => void
}

const CONNECT_CHANNEL_TYPES = [
  'telegram',
  'instagram',
  'whatsapp',
  'email',
] as const satisfies ReadonlyArray<ChannelType>

export function ConnectChannelPicker({ onSelect }: Props) {
  return (
    <div className="divide-y divide-border/60 border-y border-border/60">
      {CONNECT_CHANNEL_TYPES.map((type) => (
        <ChannelTypeCard
          key={type}
          type={type}
          onSelect={() => onSelect(type)}
        />
      ))}
    </div>
  )
}

function ChannelTypeCard({
  onSelect,
  type,
}: {
  type: ChannelType
  onSelect: () => void
}) {
  const meta = CHANNEL_META[type]

  return (
    <button
      className="group flex w-full items-center gap-4 px-1 py-4 text-left transition-colors hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      type="button"
      onClick={onSelect}
    >
      <ChannelTypeIcon type={type} size="lg" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">
            {m[`channels_type_${type}_label`]()}
          </h3>
          {meta.comingSoon && (
            <Chip color="warning" size="sm" variant="soft">
              <Chip.Label>{m.channels_coming_soon()}</Chip.Label>
            </Chip>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">
          {m[`channels_type_${type}_description`]()}
        </p>
      </div>

      <ChevronRightIcon className="size-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-foreground" />
    </button>
  )
}
