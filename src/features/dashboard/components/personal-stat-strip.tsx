import type { HomeStats } from '@/features/dashboard/api/home-stats'
import { m } from '@/paraglide/messages'
import { Card } from '@heroui/react'
import { cn } from '@heroui/styles'
import type { LucideIcon } from 'lucide-react'
import {
  AlarmClockIcon,
  ClockAlertIcon,
  InboxIcon,
  MailWarningIcon,
} from 'lucide-react'

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
    <Card
      aria-label={ariaLabel}
      className={cn(
        'transition-colors duration-200 ease-out',
        accent && 'border-primary/30 bg-primary/[0.06]',
      )}
    >
      <Card.Header className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex min-w-0 items-center gap-2">
          {accent ? (
            <span
              aria-hidden="true"
              className="bg-primary size-1.5 shrink-0 rounded-full"
            />
          ) : null}
          <Card.Description
            className={cn(
              'text-foreground/55 text-xs font-medium leading-tight',
              accent && 'text-primary/80',
            )}
          >
            {label}
          </Card.Description>
        </div>
        <span
          aria-hidden="true"
          className={cn(
            'flex size-7 items-center justify-center rounded-md',
            accent
              ? 'bg-primary text-primary-foreground'
              : 'bg-foreground/5 text-foreground/55',
          )}
        >
          <Icon className="size-4" />
        </span>
      </Card.Header>
      <Card.Content>
        <span
          key={value}
          className={cn(
            'inline-block text-3xl font-semibold tabular-nums leading-none',
            accent ? 'text-primary' : 'text-foreground',
            accent && 'unread-count-emphasis',
          )}
        >
          {value.toLocaleString()}
        </span>
      </Card.Content>
    </Card>
  )
}
