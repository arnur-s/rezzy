import { getUserDisplayName } from '@/entities/user'
import { UnreadNotificationsPopover } from '@/features/notifications'
import { useWorkspace } from '@/features/workspaces/hooks/use-workspaces'
import { m } from '@/paraglide/messages'
import { useAuth } from '@/providers/auth-provider'
import { useTheme } from '@/providers/theme-provider'
import { Avatar } from '@astryxdesign/core/Avatar'
import { BreadcrumbItem, Breadcrumbs } from '@astryxdesign/core/Breadcrumbs'
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu'
import { IconButton } from '@astryxdesign/core/IconButton'
import { TopNav, TopNavHeading } from '@astryxdesign/core/TopNav'
import { useMatches, useNavigate, useRouter } from '@tanstack/react-router'
import {
  MonitorIcon,
  MoonIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
  UserRoundIcon,
} from 'lucide-react'
import { useMemo } from 'react'

export function Header() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const router = useRouter()
  const matches = useMatches()

  const workspaceId = matches.reduce<string | undefined>((found, match) => {
    const params = match.params as Record<string, string>
    return typeof params.id === 'string' ? params.id : found
  }, undefined)
  const workspaceQuery = useWorkspace(workspaceId ?? '')

  const items = useMemo(() => {
    const workspaceName = workspaceQuery.data?.name
    return matches.flatMap((match) => {
      const crumb = match.staticData.crumb
      if (!crumb) return []
      const result = crumb({
        params: match.params,
        workspaceName,
      })
      if (!result) return []
      return Array.isArray(result) ? result : [result]
    })
  }, [matches, workspaceQuery.data?.name])

  const displayName = user
    ? getUserDisplayName(user, m.sidebar_unknown_user())
    : ''

  return (
    <TopNav
      label={m.breadcrumbs_aria_label()}
      heading={
        <TopNavHeading
          logo={<BrandLogo />}
          heading={m.sidebar_brand_label()}
          headingHref="/"
        />
      }
      startContent={
        items.length > 0 ? (
          <Breadcrumbs label={m.breadcrumbs_aria_label()}>
            {items.map((item, index) => {
              const isLast = index === items.length - 1
              const href =
                item.link && !isLast
                  ? router.buildLocation({
                      to: item.link.to,
                      params: item.link.params ?? {},
                    }).href
                  : undefined
              return (
                <BreadcrumbItem key={index} href={href} isCurrent={isLast}>
                  {item.label}
                </BreadcrumbItem>
              )
            })}
          </Breadcrumbs>
        ) : undefined
      }
      endContent={
        <>
          <IconButton
            variant="ghost"
            size="sm"
            label={m.header_search_label()}
            icon={<SearchIcon className="size-4" />}
          />
          <UnreadNotificationsPopover workspaceId={workspaceId} />

          <ThemeSwitcher />

          {user ? (
            <DropdownMenu
              hasChevron={false}
              menuWidth={192}
              button={{
                label: m.sidebar_user_menu_label(),
                isIconOnly: true,
                variant: 'ghost',
                icon: <Avatar size="sm" name={displayName} />,
              }}
              items={[
                {
                  label: m.sidebar_profile(),
                  icon: <UserRoundIcon className="size-4" />,
                  onClick: () => void navigate({ to: '/profile' }),
                },
                {
                  label: m.sidebar_settings_label(),
                  icon: <SettingsIcon className="size-4" />,
                  onClick: () => void navigate({ to: '/settings' }),
                },
              ]}
            />
          ) : null}
        </>
      }
    />
  )
}

function BrandLogo() {
  return (
    <span className="bg-accent-bg flex size-6 shrink-0 items-center justify-center rounded-md">
      <span className="text-on-accent text-sm font-bold">
        {m.sidebar_brand_label().charAt(0)}
      </span>
    </span>
  )
}

function ThemeSwitcher() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const TriggerIcon = resolvedTheme === 'dark' ? MoonIcon : SunIcon

  return (
    <DropdownMenu
      hasChevron={false}
      menuWidth={160}
      button={{
        label: m.header_theme_label(),
        isIconOnly: true,
        variant: 'ghost',
        icon: <TriggerIcon className="size-4" />,
      }}
      items={[
        {
          label: m.header_theme_system(),
          icon: <MonitorIcon className="size-4" />,
          isDisabled: theme === 'system',
          onClick: () => setTheme('system'),
        },
        {
          label: m.header_theme_light(),
          icon: <SunIcon className="size-4" />,
          isDisabled: theme === 'light',
          onClick: () => setTheme('light'),
        },
        {
          label: m.header_theme_dark(),
          icon: <MoonIcon className="size-4" />,
          isDisabled: theme === 'dark',
          onClick: () => setTheme('dark'),
        },
      ]}
    />
  )
}
