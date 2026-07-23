import { cn } from '@heroui/styles'
import { UserRoundIcon } from 'lucide-react'
import type { ContactCardMetadata } from '../../schemas/message-metadata'

type Props = {
  contacts: Array<ContactCardMetadata>
  isOutbound: boolean
}

function contactDisplayName(card: ContactCardMetadata): string {
  if (card.name) return card.name
  return [card.first_name, card.last_name].filter(Boolean).join(' ')
}

function contactPhone(card: ContactCardMetadata): string | null {
  if (card.phone) return card.phone
  const first = card.phones?.find((entry) => entry.phone || entry.wa_id)
  return first?.phone ?? (first?.wa_id ? `+${first.wa_id}` : null)
}

/** Shared contact-card rendering (one message may carry several cards). */
export function MessageContactCard({ contacts, isOutbound }: Props) {
  return (
    <div className="flex flex-col gap-2 p-0.5">
      {contacts.map((card, index) => {
        const name = contactDisplayName(card) || '—'
        const phone = contactPhone(card)
        return (
          <div key={index} className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full',
                isOutbound ? 'bg-accent-foreground/15' : 'bg-foreground/10',
              )}
            >
              <UserRoundIcon className="size-4" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{name}</span>
              {phone ? (
                <span
                  className={cn(
                    'truncate text-xs',
                    isOutbound
                      ? 'text-accent-foreground/75'
                      : 'text-foreground/60',
                  )}
                >
                  {phone}
                </span>
              ) : null}
              {card.company ? (
                <span
                  className={cn(
                    'truncate text-xs',
                    isOutbound
                      ? 'text-accent-foreground/75'
                      : 'text-foreground/60',
                  )}
                >
                  {card.company}
                </span>
              ) : null}
            </span>
          </div>
        )
      })}
    </div>
  )
}
