import { m } from '@/paraglide/messages'
import { Chip, Surface } from '@heroui/react'
import { ChevronRightIcon } from 'lucide-react'
import { CHANNEL_TYPES  } from '../types'
import type {ChannelType} from '../types';
import { CHANNEL_META } from '../utils/channel-meta'
import { ChannelTypeIcon } from './channel-type-icon'

type Props = {
  onSelect: (type: ChannelType) => void
}

export function ConnectChannelPicker({ onSelect }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">
          {m.channels_connect_title()}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {m.channels_connect_description()}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CHANNEL_TYPES.map((type) => (
          <ChannelTypeCard
            key={type}
            type={type}
            onSelect={() => onSelect(type)}
          />
        ))}
      </div>
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
    <Surface
      className="group flex cursor-pointer items-center gap-4 rounded-2xl p-5 transition hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-primary"
      variant="tertiary"
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
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
        <p className="mt-1 text-xs text-muted-foreground">
          {m[`channels_type_${type}_description`]()}
        </p>
      </div>

      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Surface>
  )
}
