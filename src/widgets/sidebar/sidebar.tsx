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
import {
  SideNav,
  SideNavHeading,
  SideNavItem,
  SideNavSection,
  useSideNavCollapse,
} from '@astryxdesign/core/SideNav'
import { Skeleton } from '@astryxdesign/core/Skeleton'
import { Tooltip } from '@astryxdesign/core/Tooltip'
import { useNavigate, useParams, useRouterState } from '@tanstack/react-router'
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
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'

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
          <SideNavHeading
            heading={m.sidebar_brand_label()}
            headingHref="/"
            icon={isCollapsed ? <BrandMark /> : undefined}
          />
        }
        collapsible={{
          isCollapsed,
          onCollapsedChange,
          buttonLabel: m.sidebar_toggle_label(),
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
 * Product mark. Carries the rail's identity while collapsed, where
 * SideNavHeading drops its text — and where the wordmark alone would leave the
 * header empty. The quiet `bg-primary/5` plate keeps it below the workspace
 * mark in the same column: the product is a constant, the workspace is the
 * thing you are currently inside.
 */
function BrandMark() {
  return (
    <span className="text-primary flex size-6 shrink-0 items-center justify-center leading-none font-semibold text-xl">
      R
    </span>
  )
}

/**
 * Workspace row at the head of the nav body, built on the same construction as
 * the account row in the footer: a ghost button restyled to read as a nav row,
 * with a chevron pinned to the trailing edge and a menu unfolding from it. The
 * rail's two entity rows — the workspace you are in, the person you are — then
 * bracket the navigation between them in one shared vocabulary.
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
  const [respondingTo, setRespondingTo] =
    useState<WorkspaceInvitation | null>(null)
  // The rail's own collapse state, not the prop: SideNav drops this context in
  // drawer and topbar modes, so the mobile drawer keeps the expanded row even
  // while the desktop rail is collapsed.
  const { isCollapsed } = useSideNavCollapse()

  const invitationsQuery = useMyInvitations()
  const invitations = invitationsQuery.data ?? []

  if (isLoading) {
    return <Skeleton width="100%" height={32} radius={3} />
  }

  if (isError) {
    return (
      <p className="text-error bg-error/5 rounded-lg px-3 py-2 text-xs">
        {m.workspaces_load_error_title()}
      </p>
    )
  }

  const label = currentWorkspace?.name ?? m.sidebar_select_workspace_label()
  const mark = currentWorkspace ? (
    <WorkspaceMark icon={currentWorkspace.icon} isActive />
  ) : (
    <WorkspacesMark />
  )

  const items: Array<DropdownMenuOption> = workspaces.map((workspace) => ({
    label: workspace.name,
    icon: (
      <WorkspaceMark
        icon={workspace.icon}
        isActive={workspace.id === currentWorkspace?.id}
      />
    ),
    onClick: () => {
      setIsOpen(false)
      onSelect(workspace)
    },
  }))
  // items.push({
  //   label: m.workspaces_create_button(),
  //   icon: <PlusIcon className="size-4" />,
  //   onClick: onCreateWorkspace,
  // })

  // Astryx DropdownMenu items are single-action rows, so Accept/Decline cannot
  // live in the menu; a row opens the dialog, which is the better home for the
  // decision anyway — at menuWidth 220 two buttons do not fit.
  if (invitations.length > 0) {
    items.push({ type: 'divider' })
    items.push({
      type: 'section',
      title: m.workspace_invitations_section_title(),
      items: invitations.map((invitation) => ({
        label: invitation.workspaceName,
        icon: <MailPlusIcon className="size-4" aria-hidden />,
        onClick: () => {
          setIsOpen(false)
          setRespondingTo(invitation)
        },
      })),
    })
  }

  const invitationCount = invitations.length
  // Purely decorative: the count it would otherwise announce lives in
  // `triggerLabel` below instead. Astryx `Button` computes its own
  // `aria-label` from the `label` prop whenever the trigger is icon-only
  // (collapsed) or is given custom `children` (expanded) — see `needsAriaLabel`
  // in Button.js — and that computed `aria-label` wins over any accessible
  // name nested content would otherwise contribute, including an `aria-label`
  // on this span (which is also invalid here: `aria-label` has no effect on an
  // element with no role). So the badge itself must stay out of the
  // accessibility tree, and the count has to reach assistive tech through the
  // one lever Button exposes for it.
  const invitationBadge =
    invitationCount > 0 ? (
      <span
        className="bg-error absolute top-0 right-0 size-2 rounded-full"
        aria-hidden
      />
    ) : null

  // Same join pattern as the contacts page's sort dropdown
  // (`${m.contacts_sort_label()}: ${...}`): the trigger's `label` prop is both
  // the accessible name (collapsed and expanded alike) and the collapsed
  // tooltip text, so the counted phrase is appended there rather than left
  // stranded in the badge's markup.
  // Same join pattern as the contacts page's sort dropdown
  // (`${m.contacts_sort_label()}: ${...}`): the trigger's `label` prop is both
  // the accessible name (collapsed and expanded alike) and the collapsed
  // tooltip text, so the counted phrase is appended there rather than left
  // stranded in the badge's markup.
  const triggerLabel =
    invitationCount > 0
      ? `${label}: ${m.workspace_invitations_indicator_aria({ count: invitationCount })}`
      : label

  const button: DropdownMenuButtonProps = isCollapsed
    ? {
        label: triggerLabel,
        variant: 'ghost',
        icon: (
          <span className="relative inline-flex">
            {mark}
            {invitationBadge}
          </span>
        ),
        isIconOnly: true,
        tooltip: triggerLabel,
      }
    : {
        label: triggerLabel,
        variant: 'ghost',
        // Same handles as the account row: 8px inset instead of Button's 12px,
        // and the label span grown so the chevron pins to the trailing edge.
        // The name keeps medium weight where the account row runs normal — it
        // is the one row that names what everything under it belongs to.
        className: 'px-2 [&>span>span:first-child]:grow',
        children: (
          <span className="flex min-w-0 items-center gap-2">
            <span className="relative inline-flex shrink-0">
              {mark}
              {invitationBadge}
            </span>
            {/* Plain workspace name, not `triggerLabel`: this is the visible
                text, and the count is already carried by `button.label` above,
                which Button uses for the accessible name instead of this
                span's content. */}
            <span className="truncate font-medium">{label}</span>
          </span>
        ),
        endContent: (
          <ChevronsUpDownIcon className="text-secondary size-4" aria-hidden />
        ),
      }

  return (
    <>
      <DropdownMenu
        button={button}
        items={items}
        isMenuOpen={isOpen}
        onOpenChange={setIsOpen}
        placement="below"
        // Expanded, the menu inherits the trigger's width so it reads as the row
        // unfolding. Collapsed, the trigger is a 32px square and needs a floor.
        menuWidth={isCollapsed ? 220 : undefined}
        hasChevron={false}
      />
      {/* Sibling of the menu, not nested inside it: DropdownMenu unmounts its
          content on close, which would take the dialog with it before the
          person could accept or decline. */}
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
        isActive
          ? 'bg-accent-bg text-on-accent'
          : 'bg-accent-bg/10 text-accent',
      )}
    >
      <WorkspaceIcon name={icon} className="size-3.5" />
    </span>
  )
}
