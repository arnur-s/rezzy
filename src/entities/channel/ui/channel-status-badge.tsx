import { m } from '@/paraglide/messages'
import { Badge } from '@astryxdesign/core/Badge'

type Props = {
  isActive: boolean
}

export function ChannelStatusBadge({ isActive }: Props) {
  return (
    <Badge
      variant={isActive ? 'success' : 'neutral'}
      label={
        isActive ? m.channels_status_active() : m.channels_status_inactive()
      }
    />
  )
}
