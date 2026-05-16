import type { HomeStats } from '@/features/dashboard/api/home-stats'
import { m } from '@/paraglide/messages'
import { Card } from '@heroui/react'
import { cn } from '@heroui/styles'
import {
  AlarmClockIcon,
  ClockAlertIcon,
  InboxIcon,
  MailWarningIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Props = {
  stats: HomeStats
}

export function PersonalStatStrip({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatTile
        label={m.home_stat_unread_assigned()}
        value={stats.unreadAssigned}
        icon={MailWarningIcon}
        ariaLabel={m.home_stat_unread_aria({ count: stats.unreadAssigned })}
        accent={stats.unreadAssigned > 0}
      />
      <StatTile
        label={m.home_stat_open_assigned()}
        value={stats.openAssigned}
        icon={InboxIcon}
        ariaLabel={m.home_stat_open_aria({ count: stats.openAssigned })}
      />
      <StatTile
        label={m.home_stat_snoozed_waking()}
        value={stats.snoozedWaking}
        icon={AlarmClockIcon}
        ariaLabel={m.home_stat_snoozed_aria({ count: stats.snoozedWaking })}
      />
      <StatTile
        label={m.home_stat_stale_assigned()}
        value={stats.staleAssigned}
        icon={ClockAlertIcon}
        ariaLabel={m.home_stat_stale_aria({ count: stats.staleAssigned })}
      />
    </div>
  )
}

function StatTile({
  label,
  value,
  icon: Icon,
  ariaLabel,
  accent,
}: {
  label: string
  value: number
  icon: LucideIcon
  ariaLabel: string
  accent?: boolean
}) {
  return (
    <Card variant="secondary" aria-label={ariaLabel}>
      <Card.Header className="flex flex-row items-center justify-between gap-2 space-y-0">
        <Card.Description className="text-foreground/55 text-xs font-medium leading-tight">
          {label}
        </Card.Description>
        <span
          aria-hidden="true"
          className={cn(
            'flex size-7 items-center justify-center rounded-md',
            accent
              ? 'bg-primary/10 text-primary'
              : 'bg-foreground/5 text-foreground/55',
          )}
        >
          <Icon className="size-4" />
        </span>
      </Card.Header>
      <Card.Content>
        <span
          className={cn(
            'text-3xl font-semibold tabular-nums leading-none',
            accent ? 'text-primary' : 'text-foreground',
          )}
        >
          {value.toLocaleString()}
        </span>
      </Card.Content>
    </Card>
  )
}
