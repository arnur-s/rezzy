import { parseSharedContacts } from '@/entities/message'
import {
  contactIdentityFromSharedContact,
  contactIdentityKey,
  contactQueryKeys,
} from '@/features/contacts'
import type { ContactMatch } from '@/features/contacts'
import { MessageContactCard } from '@/features/inbox/components/message-thread/message-contact-card'
import { workspacePhoneRegionQueryKeys } from '@/features/workspaces/api/workspace-phone-region'
import { setLocale } from '@/paraglide/runtime'
import type { Locale } from '@/paraglide/runtime'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

/**
 * Browser fixture for the shared-contact card.
 *
 * The card's five states depend on a workspace's contacts and on a provider
 * payload, neither of which a developer can conjure without seeding the shared
 * development database. This route renders the real component against seeded
 * *query cache* entries instead: no network, no Supabase, no fixture data left
 * behind, and every state reachable from a URL —
 *
 *   /e2e-shared-contact?scenario=unknown
 *   /e2e-shared-contact?scenario=existing
 *   /e2e-shared-contact?scenario=duplicate
 *   /e2e-shared-contact?scenario=ambiguous
 *   /e2e-shared-contact?scenario=loading
 *   /e2e-shared-contact?locale=ru&scenario=unknown
 *
 * `?locale=ru` plus a phone-width viewport is the check AGENTS.md asks for
 * before calling copy or layout work done, and `e2e/shared-contact-card.e2e.ts`
 * drives exactly these URLs.
 *
 * Dev-only: the component renders nothing in a production build.
 */
export const Route = createFileRoute('/e2e-shared-contact')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    scenario: typeof search.scenario === 'string' ? search.scenario : 'unknown',
    locale: search.locale === 'ru' ? 'ru' : 'en',
    region: typeof search.region === 'string' ? search.region : null,
  }),
})

const WORKSPACE_ID = 'e2e-workspace'

const PAYLOADS: Record<string, unknown> = {
  // A WhatsApp card: a written number plus the same subscriber as a wa_id.
  default: {
    contacts: [
      {
        name: 'Dana Abisheva',
        phones: [
          { phone: '+7 701 123 45 67', wa_id: '77011234567' },
          { phone: '+7 701 999 88 77' },
        ],
        emails: [{ email: 'dana@example.com' }],
        company: 'Astana Coffee',
      },
    ],
  },
  // A Telegram card whose number carries no country code.
  ambiguous: {
    contacts: [
      { first_name: 'Aizhan', last_name: 'Serik', phone: '8 (701) 123-45-67' },
    ],
  },
  // Nothing to identify the person by.
  nameOnly: { contacts: [{ name: 'Ivan' }] },
}

function match(id: string, name: string): ContactMatch {
  return {
    id,
    name,
    phone: '+77011234567',
    email: null,
    avatar_url: null,
    status: 'new',
    match_reason: 'phone',
  }
}

const MATCHES: Record<string, Array<ContactMatch>> = {
  unknown: [],
  existing: [match('contact-1', 'Dana Abisheva')],
  duplicate: [
    match('contact-1', 'Dana Abisheva'),
    match('contact-2', 'D. Abisheva'),
  ],
}

function RouteComponent() {
  const { scenario, locale, region } = Route.useSearch()
  const queryClient = useQueryClient()

  const payload =
    scenario === 'ambiguous'
      ? PAYLOADS.ambiguous
      : scenario === 'name-only'
        ? PAYLOADS.nameOnly
        : PAYLOADS.default
  const contacts = parseSharedContacts(payload)

  // Seeded once, before the card mounts, so nothing ever reaches the network.
  const [isSeeded] = useState(() => {
    setLocale(locale as Locale, { reload: false })
    queryClient.setQueryData(
      workspacePhoneRegionQueryKeys.detail(WORKSPACE_ID),
      region,
    )

    if (scenario !== 'loading') {
      const lookup = contactIdentityFromSharedContact(contacts[0], {
        workspaceRegion: region,
      })
      queryClient.setQueryData(
        contactQueryKeys.match(WORKSPACE_ID, contactIdentityKey(lookup)),
        MATCHES[scenario] ?? [],
      )
    }
    return true
  })

  if (!import.meta.env.DEV) return null
  if (!isSeeded) return null

  return (
    <div className="bg-body flex min-h-dvh items-start justify-center p-4">
      <div
        // Roughly a message bubble's width on a phone, which is where the
        // Russian copy has to be checked.
        className="bg-surface w-full max-w-[320px] rounded-lg p-3"
        data-testid="shared-contact-harness"
      >
        <MessageContactCard
          contacts={contacts}
          isOutbound={false}
          workspaceId={WORKSPACE_ID}
        />
      </div>
    </div>
  )
}
