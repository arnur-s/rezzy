import { m } from '@/paraglide/messages'
import { Avatar, Card } from '@heroui/react'
import type { User } from '@supabase/supabase-js'
import { MailIcon, UserRoundIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { getUserDisplayName, getUserInitials } from '../utils/user-display'

type UserProfilePageProps = {
  user: User
}

export function UserProfilePage({ user }: UserProfilePageProps) {
  const name = getUserDisplayName(user, m.app_sidebar_unknown_user())
  const email = user.email ?? m.app_sidebar_unknown_email()

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">
          {m.profile_page_kicker()}
        </p>
        <h1 className="text-3xl font-semibold tracking-normal">
          {m.profile_page_title()}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {m.profile_page_description()}
        </p>
      </header>

      <Card className="border border-border bg-card text-card-foreground shadow-surface">
        <Card.Header className="gap-4">
          <Avatar color="accent" size="lg" variant="soft">
            <Avatar.Fallback>{getUserInitials(name)}</Avatar.Fallback>
          </Avatar>
          <div className="min-w-0">
            <Card.Title className="truncate">{name}</Card.Title>
            <Card.Description className="truncate">{email}</Card.Description>
          </div>
        </Card.Header>
        <Card.Content>
          <div className="grid gap-4 sm:grid-cols-2">
            <ProfileField
              icon={<UserRoundIcon className="size-4" />}
              label={m.profile_page_name_label()}
              value={name}
            />
            <ProfileField
              icon={<MailIcon className="size-4" />}
              label={m.profile_page_email_label()}
              value={email}
            />
          </div>
        </Card.Content>
      </Card>
    </section>
  )
}

function ProfileField({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <p className="mt-2 truncate text-sm font-medium">{value}</p>
    </div>
  )
}
