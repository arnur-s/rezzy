import {
  getUserDisplayName,
  getUserInitials,
} from '@/entities/user'
import { useWorkspace } from '@/features/workspaces/hooks/use-workspaces'
import { m } from '@/paraglide/messages'
import { useAuth } from '@/providers/auth-provider'
import type { Theme } from '@/providers/theme-provider'
import { useTheme } from '@/providers/theme-provider'
import { Avatar, Button, Dropdown, Label, Separator } from '@heroui/react'
import { cn } from '@heroui/styles'
import { Link, useMatches, useNavigate } from '@tanstack/react-router'
import {
  BellIcon,
  CheckIcon,
  ChevronRightIcon,
  MonitorIcon,
  MoonIcon,
  PanelLeftIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
  UserRoundIcon,
} from 'lucide-react'
import { useMemo } from 'react'

export interface AppHeaderProps {
  className?: string
  onToggleSidebar?: () => void
}

export function AppHeader({ className, onToggleSidebar }: AppHeaderProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
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
    ? getUserDisplayName(user, m.app_sidebar_unknown_user())
    : ''

  return (
    <header
      className={cn(
        'border-border/60 border-b flex h-[64px] shrink-0 items-center gap-2 px-4 backdrop-blur z-1',
        className,
      )}
    >
      <Button
        isIconOnly
        variant="ghost"
        size="sm"
        aria-label={m.app_sidebar_toggle_label()}
        onPress={onToggleSidebar}
      >
        <PanelLeftIcon className="size-4" />
      </Button>
      <nav
        aria-label={m.app_breadcrumbs_aria_label()}
        className="text-muted-foreground flex min-w-0 flex-1 items-center text-sm"
      >
        <ol className="flex min-w-0 flex-wrap items-center gap-1">
          {items.map((item, index) => {
            const isLast = index === items.length - 1
            return (
              <li key={index} className="flex min-w-0 items-center gap-1">
                {index > 0 ? (
                  <ChevronRightIcon
                    className="text-foreground/30 size-3.5 shrink-0"
                    aria-hidden
                  />
                ) : null}
                {item.link && !isLast ? (
                  <Link
                    to={item.link.to}
                    params={item.link.params}
                    className="hover:text-foreground min-w-0 truncate transition-colors"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    className={cn(
                      'min-w-0 truncate',
                      isLast && 'text-foreground font-semibold',
                    )}
                    aria-current={isLast ? 'page' : undefined}
                  >
                    {item.label}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Button
          isIconOnly
          variant="ghost"
          size="sm"
          aria-label={m.app_header_search_label()}
        >
          <SearchIcon className="size-4" />
        </Button>
        <Button
          isIconOnly
          variant="ghost"
          size="sm"
          aria-label={m.app_header_notifications_label()}
        >
          <BellIcon className="size-4" />
        </Button>

        <ThemeSwitcher />

        {user ? (
          <>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <Dropdown>
              <Dropdown.Trigger
                aria-label={m.app_sidebar_user_menu_label()}
                className="ring-offset-background focus-visible:ring-ring shrink-0 rounded-full outline-none focus-visible:ring-2"
              >
                <Avatar color="accent" size="sm" variant="soft">
                  <Avatar.Fallback>
                    {getUserInitials(displayName)}
                  </Avatar.Fallback>
                </Avatar>
              </Dropdown.Trigger>
              <Dropdown.Popover className="min-w-48">
                <Dropdown.Menu
                  onAction={(key) => {
                    if (key === 'profile') void navigate({ to: '/profile' })
                    if (key === 'app-settings')
                      void navigate({ to: '/settings' })
                  }}
                >
                  <Dropdown.Item
                    id="profile"
                    textValue={m.app_sidebar_profile()}
                  >
                    <UserRoundIcon className="size-4" />
                    <Label>{m.app_sidebar_profile()}</Label>
                  </Dropdown.Item>
                  <Dropdown.Item
                    id="app-settings"
                    textValue={m.app_sidebar_app_settings_label()}
                  >
                    <SettingsIcon className="size-4" />
                    <Label>{m.app_sidebar_app_settings_label()}</Label>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </>
        ) : null}
      </div>
    </header>
  )
}

function ThemeSwitcher() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const TriggerIcon = resolvedTheme === 'dark' ? MoonIcon : SunIcon

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label={m.app_header_theme_label()}
        className="text-foreground hover:bg-sidebar-accent inline-flex size-8 shrink-0 items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <TriggerIcon className="size-4" />
      </Dropdown.Trigger>
      <Dropdown.Popover className="min-w-40">
        <Dropdown.Menu onAction={(key) => setTheme(key as Theme)}>
          <Dropdown.Item id="system" textValue={m.app_header_theme_system()}>
            <MonitorIcon className="size-4" />
            <Label className="flex-1">{m.app_header_theme_system()}</Label>
            {theme === 'system' && (
              <CheckIcon className="text-primary ml-auto size-3.5" />
            )}
          </Dropdown.Item>
          <Dropdown.Item id="light" textValue={m.app_header_theme_light()}>
            <SunIcon className="size-4" />
            <Label className="flex-1">{m.app_header_theme_light()}</Label>
            {theme === 'light' && (
              <CheckIcon className="text-primary ml-auto size-3.5" />
            )}
          </Dropdown.Item>
          <Dropdown.Item id="dark" textValue={m.app_header_theme_dark()}>
            <MoonIcon className="size-4" />
            <Label className="flex-1">{m.app_header_theme_dark()}</Label>
            {theme === 'dark' && (
              <CheckIcon className="text-primary ml-auto size-3.5" />
            )}
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}
