import { m } from '@/paraglide/messages'
import { Card } from '@astryxdesign/core/Card'
import { cn } from '@/lib/cn'
import {
  InboxIcon,
  MailWarningIcon,
  RadioTowerIcon,
  UsersIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Props = {
  unread: number
  open: number
  channels: number
  contacts: number
}

export function AggregateStatStrip({ unread, open, channels, contacts }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatCard
        label={m.dashboard_stat_unread()}
        value={unread}
        icon={MailWarningIcon}
        accent={unread > 0}
      />
      <StatCard
        label={m.dashboard_stat_open()}
        value={open}
        icon={InboxIcon}
      />
      <StatCard
        label={m.dashboard_stat_channels()}
        value={channels}
        icon={RadioTowerIcon}
      />
      <StatCard
        label={m.dashboard_stat_contacts()}
        value={contacts}
        icon={UsersIcon}
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: number
  icon: LucideIcon
  accent?: boolean
}) {
  return (
    <Card variant="muted">
      <div className="flex flex-row items-center justify-between gap-2">
        <span className="text-secondary text-xs tracking-wide uppercase">
          {label}
        </span>
        <span
          className={cn(
            'flex size-7 items-center justify-center rounded-md',
            accent
              ? 'bg-accent-bg/10 text-accent'
              : 'bg-primary/5 text-primary/60',
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-2">
        <span
          className={cn(
            'text-3xl font-semibold tabular-nums',
            accent && 'text-accent',
          )}
        >
          {value.toLocaleString()}
        </span>
      </div>
    </Card>
  )
}
