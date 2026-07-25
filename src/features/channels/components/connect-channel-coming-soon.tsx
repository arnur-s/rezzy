import type { ChannelType } from '@/entities/channel'
import { ChannelTypeIcon } from '@/entities/channel'
import { m } from '@/paraglide/messages'
import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'

type Props = {
  type: Exclude<ChannelType, 'telegram' | 'whatsapp' | 'instagram'>
  onCancel: () => void
}

const CONNECT_LABEL_KEYS = {
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
            <Badge variant="warning" label={m.channels_coming_soon()} />
          </div>
          <p className="mt-1 text-sm text-secondary">
            {m[`channels_type_${type}_description`]()}
          </p>
        </div>
      </div>

      <div className="border-border/30 bg-muted/30 text-secondary flex flex-col gap-3 rounded-2xl border border-dashed p-6 text-sm">
        <p>{m.channels_coming_soon_body()}</p>
        <div className="self-start">
          <Button label={m[ctaKey]()} isDisabled />
        </div>
      </div>

      <div className="flex">
        <Button label={m.common_back()} variant="secondary" onClick={onCancel} />
      </div>
    </div>
  )
}
