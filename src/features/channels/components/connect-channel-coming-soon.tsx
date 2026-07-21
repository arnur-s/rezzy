import type { ChannelType } from '@/entities/channel'
import { ChannelTypeIcon } from '@/entities/channel'
import { m } from '@/paraglide/messages'
import { Button, Chip } from '@heroui/react'

type Props = {
  type: Exclude<ChannelType, 'telegram' | 'whatsapp'>
  onCancel: () => void
}

const CONNECT_LABEL_KEYS = {
  instagram: 'channels_instagram_connect_cta',
  email: 'channels_email_connect_cta',
} as const

export function ConnectChannelComingSoon({ onCancel, type }: Props) {
  const ctaKey = CONNECT_LABEL_KEYS[type]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-4">
        <ChannelTypeIcon type={type} size="lg" />
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">
              {m[`channels_type_${type}_label`]()}
            </h2>
            <Chip color="warning" size="sm" variant="soft">
              <Chip.Label>{m.channels_coming_soon()}</Chip.Label>
            </Chip>
          </div>
          <p className="mt-1 text-sm text-muted">
            {m[`channels_type_${type}_description`]()}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-muted/30 bg-muted/30 p-6 text-sm text-muted">
        <p>{m.channels_coming_soon_body()}</p>
        <Button isDisabled className="self-start">
          {m[ctaKey]()}
        </Button>
      </div>

      <div className="flex">
        <Button variant="secondary" onClick={onCancel}>
          {m.common_back()}
        </Button>
      </div>
    </div>
  )
}
