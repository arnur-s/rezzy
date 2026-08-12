import logo from '@/assets/logo.png'
import { List } from '@/components/list'
import type { Workspace } from '@/entities/workspace'
import { WorkspaceIcon } from '@/entities/workspace'
import { useMyIdentity } from '@/features/account'
import { useWorkspaceReadiness } from '@/features/channels/hooks/use-channels'
import { UnreadNotificationsNavItem } from '@/features/notifications'
import type { WorkspaceInvitation } from '@/features/workspaces/api/workspace-membership'
import { CreateWorkspaceModal } from '@/features/workspaces/components/create-workspace-modal'
import { InvitationResponseDialog } from '@/features/workspaces/components/invitation-response-dialog'
import { useMyInvitations } from '@/features/workspaces/hooks/use-workspace-membership'
import { useWorkspaces } from '@/features/workspaces/hooks/use-workspaces'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { useAuth } from '@/providers/auth-provider'
import { Avatar } from '@astryxdesign/core/Avatar'
import type {
  DropdownMenuButtonProps,
  DropdownMenuOption,
} from '@astryxdesign/core/DropdownMenu'
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu'
import { Popover } from '@astryxdesign/core/Popover'
import {
  SideNav,
  SideNavItem,
  SideNavSection,
  useSideNavCollapse,
} from '@astryxdesign/core/SideNav'
import { Skeleton } from '@astryxdesign/core/Skeleton'
import { Tooltip } from '@astryxdesign/core/Tooltip'
import {
  Link,
  useNavigate,
  useParams,
  useRouterState,
} from '@tanstack/react-router'
import {
  ChevronsUpDownIcon,
  HomeIcon,
  LayoutDashboard,
  LayoutGridIcon,
  MailPlusIcon,
  MessageCircleIcon,
  SettingsIcon,
  UserRoundIcon,
  UsersRoundIcon,
} from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

export interface SidebarProps {
  isCollapsed: boolean
  onCollapsedChange: (isCollapsed: boolean) => void
  /** Called after a navigation is triggered (used to close the mobile drawer). */
  onNavigate?: () => void
}

/**
 * Route prefixes scoped to the person rather than to a workspace.
 * `/notifications` belongs here for the same reason home does: it aggregates
 * every workspace, so pinning the rail to an arbitrary "current" one would name
 * a workspace the page is not showing.
 */
const ACCOUNT_ROUTE_PREFIXES = ['/settings', '/profile', '/notifications']

function isAccountRoute(pathname: string) {
  return ACCOUNT_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function Sidebar({
  isCollapsed,
  onCollapsedChange,
  onNavigate,
}: SidebarProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false)

  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const params = useParams({ strict: false })
  const currentWorkspaceId = params.id
  const isHomeArea = pathname === '/' || isAccountRoute(pathname)

  const workspacesQuery = useWorkspaces(user?.id ?? '')

  const currentWorkspace = useMemo(
    () =>
      isHomeArea
        ? undefined
        : (workspacesQuery.data?.find((w) => w.id === currentWorkspaceId) ??
          workspacesQuery.data?.[0]),
    [workspacesQuery.data, currentWorkspaceId, isHomeArea],
  )

  const readiness = useWorkspaceReadiness(currentWorkspace?.id ?? '')

  // Only once readiness is known false. An unsettled or failed check leaves the
  // item alone rather than flickering it disabled on every workspace switch —
  // the route guard is what actually enforces the rule.
  const isInboxLocked =
    !readiness.isPending && !readiness.isError && !readiness.hasActiveChannel

  if (!user) return null

  return (
    <>
      <SideNav
        // Identity only. The workspace switcher used to share this row; it now
        // sits in the nav body where it belongs — it is a destination you
        // change, not the name of the product.
        header={
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Rezzy" className="size-8" />
            {!isCollapsed && (
              <span className="text-primary text-xl font-bold">Rezzy</span>
            )}
          </Link>
        }
        collapsible={{
          isCollapsed,
          onCollapsedChange,
          buttonLabel: m.sidebar_toggle_label(),
          hasButton: true,
        }}
        footer={<AccountMenu onNavigate={onNavigate} />}
      >
        <SideNavSection
          title={m.sidebar_workspace_nav_aria_label()}
          isHeaderHidden
        >
          <WorkspaceSwitcher
            currentWorkspace={currentWorkspace}
            workspaces={workspacesQuery.data ?? []}
            isLoading={workspacesQuery.isPending}
            isError={workspacesQuery.isError}
            // onCreateWorkspace={() => setIsCreateWorkspaceOpen(true)}
            onSelect={(workspace) => {
              onNavigate?.()
              void navigate({
                to: '/workspaces/$id/inbox',
                params: { id: workspace.id },
              })
            }}
          />

          {currentWorkspace ? (
            <WorkspaceItemGroup label={currentWorkspace.name}>
              <SideNavItem
                label={m.sidebar_dashboard_label()}
                icon={LayoutDashboard}
                href={`/workspaces/${currentWorkspace.id}`}
                isSelected={
                  pathname === `/workspaces/${currentWorkspace.id}` ||
                  pathname === `/workspaces/${currentWorkspace.id}/`
                }
                onClick={onNavigate}
              />
              <Tooltip
                content={m.sidebar_inbox_locked_tooltip()}
                isEnabled={isInboxLocked}
                placement="end"
              >
                <SideNavItem
                  label={m.sidebar_inbox_label()}
                  icon={MessageCircleIcon}
                  href={`/workspaces/${currentWorkspace.id}/inbox`}
                  isSelected={pathname.startsWith(
                    `/workspaces/${currentWorkspace.id}/inbox`,
                  )}
                  isDisabled={isInboxLocked}
                  onClick={onNavigate}
                />
              </Tooltip>
              <SideNavItem
                label={m.sidebar_contacts_label()}
                icon={UsersRoundIcon}
                href={`/workspaces/${currentWorkspace.id}/contacts`}
                isSelected={pathname.startsWith(
                  `/workspaces/${currentWorkspace.id}/contacts`,
                )}
                onClick={onNavigate}
              />
              <SideNavItem
                label={m.common_settings()}
                icon={SettingsIcon}
                href={`/workspaces/${currentWorkspace.id}/settings`}
                isSelected={pathname.startsWith(
                  `/workspaces/${currentWorkspace.id}/settings`,
                )}
                onClick={onNavigate}
              />
            </WorkspaceItemGroup>
          ) : null}
        </SideNavSection>

        {/* Home and unread both span every workspace, so they sit apart from
            the block above, which only describes where you currently are. The
            separation is SideNav's own section spacing: a rule here would be
            the third horizontal line in a rail that the shell now separates
            with a gutter. */}
        <SideNavSection
          title={m.sidebar_general_nav_aria_label()}
          isHeaderHidden
        >
          <SideNavItem
            label={m.sidebar_home_nav_label()}
            icon={HomeIcon}
            href="/"
            isSelected={pathname === '/'}
            onClick={onNavigate}
          />
          <UnreadNotificationsNavItem
            workspaceId={currentWorkspaceId}
            onNavigate={onNavigate}
          />
        </SideNavSection>
      </SideNav>

      <CreateWorkspaceModal
        isOpen={isCreateWorkspaceOpen}
        onOpenChange={setIsCreateWorkspaceOpen}
      />
    </>
  )
}

/**
 * Account row in the nav footer: profile, app settings, and sign-out, grouped
 * because all three are scoped to the person rather than to a workspace.
 */
function AccountMenu({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  // The rail's own collapse state, not the prop: SideNav drops this context in
  // drawer and topbar modes, so the mobile drawer keeps the expanded row even
  // while the desktop rail is collapsed.
  const { isCollapsed } = useSideNavCollapse()

  // The saved profile, not auth metadata: this row is the one place the user
  // sees themselves on every screen, so it has to reflect the name and picture
  // they set on the profile page rather than what they typed at sign-up.
  const { displayName, avatarUrl } = useMyIdentity()

  if (!user) return null

  function go(to: '/settings/profile' | '/settings/appearance') {
    setIsOpen(false)
    onNavigate?.()
    void navigate({ to })
  }

  const items: Array<DropdownMenuOption> = [
    {
      label: m.sidebar_profile(),
      icon: <UserRoundIcon className="size-4" />,
      onClick: () => go('/settings/profile'),
    },
  ]

  const button: DropdownMenuButtonProps = isCollapsed
    ? {
        label: displayName,
        variant: 'ghost',
        icon: <Avatar size="sm" name={displayName} src={avatarUrl} />,
        isIconOnly: true,
        tooltip: displayName,
        // Marker only, carries no styles of its own. `.sidebar-account-row` in
        // src/styles.css uses it to reach SideNav's footer zone.
        className: 'sidebar-account-row',
      }
    : {
        label: displayName,
        variant: 'ghost',
        // Button centers its content, pads to 12px, and sets medium weight.
        // The account row has to read as the last nav row instead: 8px inset,
        // normal weight, and a label that grows so the chevron pins to the
        // trailing edge. Button's label span is the only handle it exposes for
        // that last part — it is the first child of the content wrapper here
        // because this row passes `children` rather than `icon`.
        //
        // `sidebar-account-row` is a marker with no styles of its own; see
        // src/styles.css.
        className:
          'sidebar-account-row px-2 font-normal [&>span>span:first-child]:grow',
        children: (
          <span className="flex min-w-0 items-center gap-2">
            <Avatar size="sm" name={displayName} src={avatarUrl} />
            <span className="truncate">{displayName}</span>
          </span>
        ),
        endContent: (
          <ChevronsUpDownIcon className="text-secondary size-4" aria-hidden />
        ),
      }

  return (
    <DropdownMenu
      button={button}
      items={items}
      isMenuOpen={isOpen}
      onOpenChange={setIsOpen}
      placement="above"
      // Expanded, the menu inherits the trigger's width so it reads as the row
      // unfolding. Collapsed, the trigger is a 32px square and needs a floor.
      menuWidth={isCollapsed ? 200 : undefined}
      hasChevron={false}
    />
  )
}

/**
 * Workspace row at the head of the nav body. It is a `SideNavItem` — the same
 * component as every other row in the rail — rather than a ghost button talked
 * into looking like one: the row chrome (height, inset, radius, hover, type)
 * then comes from the design system instead of from local overrides that drift.
 * The list opens in a sibling `Popover`, the construction the notifications row
 * already uses, because `DropdownMenu` insists on rendering its own `Button`.
 */
function WorkspaceSwitcher({
  currentWorkspace,
  workspaces,
  isLoading,
  isError,
  onSelect,
  // onCreateWorkspace,
}: {
  currentWorkspace: Workspace | undefined
  workspaces: Array<Workspace>
  isLoading: boolean
  isError: boolean
  onSelect: (workspace: Workspace) => void
  // onCreateWorkspace: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [respondingTo, setRespondingTo] = useState<WorkspaceInvitation | null>(
    null,
  )
  // Sibling mode: the popover anchors to SideNavItem's own button rather than
  // wrapping it in a div, which would break the nav row's full-width layout.
  const triggerRef = useRef<HTMLElement>(null)
  // The rail's own collapse state, not the prop: SideNav drops this context in
  // drawer and topbar modes, so the mobile drawer keeps the expanded row even
  // while the desktop rail is collapsed.
  const { isCollapsed } = useSideNavCollapse()

  const invitationsQuery = useMyInvitations()
  const invitations = invitationsQuery.data ?? []
  const invitationCount = invitations.length

  const label = currentWorkspace?.name ?? m.sidebar_select_workspace_label()

  // The whole sentence — including the separator between the workspace name
  // and the count — is composed inside the message catalogue via the
  // `workspace` placeholder, not joined with a literal here: a hardcoded `": "`
  // would be a typographic choice authored in TypeScript instead of the copy it
  // actually is, and Russian and English do not have to agree on it.
  const triggerLabel =
    invitationCount > 0
      ? m.workspace_invitations_indicator_aria({
          workspace: label,
          count: invitationCount,
        })
      : label

  // `SideNavItem` renders `label` as the row's visible text and takes no
  // `aria-label` of its own once expanded, so the counted phrase is written
  // onto the trigger button directly — the same element, through the same
  // lever, that `Popover` uses for its own ARIA below. Carrying the count in
  // visually-hidden markup inside the row does not work: a name assembled from
  // contents runs the two strings together with no separator. `isCollapsed` is
  // a dependency because the collapsed and expanded rows are different
  // elements, and the new one arrives without the attribute.
  useEffect(() => {
    triggerRef.current?.setAttribute('aria-label', triggerLabel)
  }, [triggerLabel, isCollapsed])

  if (isLoading) {
    return <Skeleton width="100%" height={32} radius={3} />
  }

  if (isError) {
    return (
      <p className="text-error bg-error/5 rounded-lg px-3 py-2 text-sm">
        {m.workspaces_load_error_title()}
      </p>
    )
  }

  const mark = currentWorkspace ? (
    <WorkspaceMark icon={currentWorkspace.icon} isActive />
  ) : (
    <WorkspacesMark />
  )

  const content = (
    <div className="flex w-full flex-col overflow-hidden">
      <List className="p-1.5">
        {workspaces.map((workspace) => {
          const isCurrent = workspace.id === currentWorkspace?.id
          return (
            <List.Item key={workspace.id} isActive={isCurrent}>
              <button
                type="button"
                className="cursor-pointer px-2"
                aria-current={isCurrent ? true : undefined}
                onClick={() => {
                  setIsOpen(false)
                  onSelect(workspace)
                }}
              >
                <WorkspaceMark icon={workspace.icon} isActive={isCurrent} />
                <span className="flex-1 truncate text-left">
                  {workspace.name}
                </span>
              </button>
            </List.Item>
          )
        })}
      </List>

      {/* A row opens the dialog rather than carrying Accept/Decline itself:
          two buttons do not fit at this width, and the decision belongs with
          the invitation's detail anyway. */}
      {invitations.length > 0 ? (
        <div className="border-border/60 border-t p-1.5">
          <p className="text-secondary px-2 pt-1 pb-1.5 text-sm font-semibold">
            {m.workspace_invitations_section_title()}
          </p>
          <List>
            {invitations.map((invitation) => (
              <List.Item key={invitation.id}>
                <button
                  type="button"
                  className="cursor-pointer px-2"
                  onClick={() => {
                    setIsOpen(false)
                    setRespondingTo(invitation)
                  }}
                >
                  <MailPlusIcon className="size-4 shrink-0" aria-hidden />
                  <span className="flex-1 truncate text-left">
                    {invitation.workspaceName}
                  </span>
                </button>
              </List.Item>
            ))}
          </List>
        </div>
      ) : null}
    </div>
  )

  // Purely decorative: the count it stands for reaches assistive technology
  // through the trigger's `aria-label` instead.
  const invitationBadge =
    invitationCount > 0 ? (
      <span
        className="bg-error absolute top-0 right-0 size-2 rounded-full"
        aria-hidden
      />
    ) : null

  return (
    <>
      <SideNavItem
        ref={triggerRef}
        // Expanded, `label` is the row's visible text, so it stays the bare
        // workspace name. Collapsed, the row is icon-only and `label` is what
        // the tooltip shows, so the counted phrase belongs there.
        label={isCollapsed ? triggerLabel : label}
        icon={
          <span className="relative inline-flex shrink-0">
            {mark}
            {invitationBadge}
          </span>
        }
        endContent={
          <ChevronsUpDownIcon className="text-secondary size-4" aria-hidden />
        }
      />

      <Popover
        // Astryx types anchorRef as a non-null RefObject, but any DOM ref is
        // null until mount. Popover reads it inside a layout effect and bails
        // when it is empty, so the narrowing is safe.
        anchorRef={triggerRef as RefObject<HTMLElement>}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        placement="below"
        alignment="start"
        // Expanded, the surface inherits the trigger's width so it reads as the
        // row unfolding. Collapsed, the trigger is a 32px square and needs a
        // floor.
        width={isCollapsed ? 220 : undefined}
        label={m.sidebar_select_workspace_label()}
        // The rows carry their own 6px gutter; paying Astryx's 12px surface
        // padding on top of it would inset them twice and leave the invitations
        // rule floating short of both edges.
        className="overflow-hidden p-0"
        // The default close button is first in focus order, so autofocus lands
        // on it and reveals it. Escape and outside click still dismiss.
        hasCloseButton={false}
        content={isOpen ? content : null}
      />
      {/* Sibling of the popover, not nested inside it: the content unmounts on
          close, which would take the dialog with it before the person could
          accept or decline. */}
      <InvitationResponseDialog
        invitation={respondingTo}
        onOpenChange={(open) => {
          if (!open) setRespondingTo(null)
        }}
      />
    </>
  )
}

/**
 * The selected workspace's destinations, bracketed to the switcher above them
 * by a hairline dropped from the workspace mark's axis. The indent is what
 * says "these belong to that workspace", so the group never has to repeat the
 * name two rows below the row that already shows it — the name goes to the
 * accessible group label instead. Collapsed, there is no text to indent
 * against, so the bracket is dropped and the icons stay on the rail's axis.
 */
function WorkspaceItemGroup({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  const { isCollapsed } = useSideNavCollapse()

  return (
    <SideNavSection
      title={label}
      isHeaderHidden
      // `ml-5` drops the rule on the workspace mark's own centre axis, so the
      // bracket reads as descending from that plate. It runs at full
      // `border-border` rather than the `/60` the horizontal rules use: the
      // same alpha that divides two regions across 244px vanishes over an 80px
      // vertical, so matching the number would not match the weight.
      className={isCollapsed ? undefined : 'border-border ml-5 border-l pl-1.5'}
    >
      {children}
    </SideNavSection>
  )
}

/** Neutral mark for the switcher before a workspace is chosen. */
function WorkspacesMark() {
  return (
    <span className="bg-accent-bg/10 text-accent flex size-6 shrink-0 items-center justify-center rounded-md">
      <LayoutGridIcon className="size-3.5" aria-hidden />
    </span>
  )
}

function WorkspaceMark({
  icon,
  isActive,
}: {
  icon: Workspace['icon']
  isActive: boolean
}) {
  return (
    <span
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-md font-semibold',
        // The active plate is a solid accent surface, so it takes the brand
        // ramp rather than the flat tone. `text-on-dark` rather than
        // `text-on-accent`: the ramp is dark in both modes, so the label must
        // not invert with the accent.
        isActive
          ? 'bg-accent-gradient text-on-dark'
          : 'bg-accent-bg/10 text-accent',
      )}
    >
      <WorkspaceIcon name={icon} className="size-3.5" />
    </span>
  )
}
