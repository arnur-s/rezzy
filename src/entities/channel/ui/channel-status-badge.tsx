import { m } from '@/paraglide/messages'
import { Chip } from '@heroui/react'

type Props = {
  isActive: boolean
}

export function ChannelStatusBadge({ isActive }: Props) {
  return (
    <Chip
      color={isActive ? 'success' : 'default'}
      size="sm"
      variant="soft"
    >
      <Chip.Label>
        {isActive
          ? m.channels_status_active()
          : m.channels_status_inactive()}
      </Chip.Label>
    </Chip>
  )
}
