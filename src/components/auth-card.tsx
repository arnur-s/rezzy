import logo from '@/assets/logo.png'
import { m } from '@/paraglide/messages'
import { Card } from '@astryxdesign/core/Card'
import { Text } from '@astryxdesign/core/Text'

type AuthCardProps = {
  children: React.ReactNode
  description: string
  title: string
}

/**
 * The shell every unauthenticated screen sits in: brand lockup, then one card
 * carrying a centered header and the form. Kept in one place so sign-in,
 * sign-up, and the two password-reset states cannot drift apart.
 */
export function AuthCard({ children, description, title }: AuthCardProps) {
  return (
    <div className="bg-surface md:bg-body flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="flex flex-col items-center gap-2">
        <img src={logo} alt="Rezzy" className="size-11" />
        <Text as="p" type="supporting" justify="center">
          {m.auth_sign_in_brand_tagline()}
        </Text>
      </div>

      <Card variant="default" maxWidth={448} width="100%" padding={8}>
        <div className="flex flex-col items-center gap-1 text-center">
          <Text as="p" size="lg" weight="semibold">
            {title}
          </Text>
          <Text as="p" type="supporting">
            {description}
          </Text>
        </div>

        {children}
      </Card>
    </div>
  )
}
