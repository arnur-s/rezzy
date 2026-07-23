import { m } from '@/paraglide/messages'
import { cn } from '@heroui/styles'
import { MapPinIcon } from 'lucide-react'
import type { LocationMetadata } from '../../schemas/message-metadata'

type Props = {
  location: LocationMetadata
  isOutbound: boolean
}

/** Shared location / venue / live location card with an external map link. */
export function MessageLocation({ location, isOutbound }: Props) {
  const mapUrl = `https://maps.google.com/?q=${location.latitude},${location.longitude}`
  const title =
    location.name ??
    (location.kind === 'live'
      ? m.inbox_location_live()
      : m.inbox_message_type_location())

  return (
    <a
      href={mapUrl}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        'flex items-start gap-2 rounded-lg p-1 text-sm hover:opacity-80',
        isOutbound ? 'text-accent-foreground' : 'text-foreground',
      )}
    >
      <MapPinIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="flex min-w-0 flex-col">
        <span className="font-medium">{title}</span>
        {location.address ? (
          <span
            className={cn(
              'text-xs',
              isOutbound ? 'text-accent-foreground/75' : 'text-foreground/60',
            )}
          >
            {location.address}
          </span>
        ) : null}
        <span
          className={cn(
            'text-xs underline underline-offset-2',
            isOutbound ? 'text-accent-foreground/75' : 'text-foreground/60',
          )}
        >
          {m.inbox_location_open_map()}
        </span>
      </span>
    </a>
  )
}
