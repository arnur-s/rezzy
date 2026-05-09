import {
  Button,
  Drawer,
  ScrollShadow,
  Separator,
  Skeleton,
  Tooltip,
} from '@heroui/react'
import { cn } from '@heroui/styles'
import { PanelLeftIcon } from 'lucide-react'
import {
  cloneElement,
  isValidElement,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react'
import { SIDEBAR_WIDTH_MOBILE, useSidebar } from './sidebar-context'

type SidebarSide = 'left' | 'right'
type SidebarVariant = 'sidebar' | 'floating' | 'inset'
type SidebarCollapsible = 'offcanvas' | 'icon' | 'none'

type WithAsChild<T> = T & { asChild?: boolean }

function renderAsChild<P extends { className?: string }>(
  child: ReactNode,
  baseProps: P,
): ReactElement | null {
  if (!isValidElement(child)) {
    return null
  }

  const childProps = (child.props ?? {}) as { className?: string }

  return cloneElement(
    child as ReactElement<P>,
    {
      ...baseProps,
      className: cn(baseProps.className, childProps.className),
    } as P,
  )
}

export function Sidebar({
  side = 'left',
  variant = 'sidebar',
  collapsible = 'offcanvas',
  className,
  children,
  ...props
}: ComponentProps<'div'> & {
  side?: SidebarSide
  variant?: SidebarVariant
  collapsible?: SidebarCollapsible
}) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar()

  if (collapsible === 'none') {
    return (
      <div
        data-slot="sidebar"
        className={cn(
          'flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    )
  }

  if (isMobile) {
    return (
      <Drawer isOpen={openMobile} onOpenChange={setOpenMobile}>
        <Drawer.Backdrop>
          <Drawer.Content placement={side}>
            <Drawer.Dialog
              data-sidebar="sidebar"
              data-slot="sidebar"
              data-mobile="true"
              className="flex h-full flex-col bg-sidebar p-0 text-sidebar-foreground outline-none"
              style={
                {
                  width: SIDEBAR_WIDTH_MOBILE,
                  maxWidth: SIDEBAR_WIDTH_MOBILE,
                } as CSSProperties
              }
            >
              {children}
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
    )
  }

  return (
    <div
      className="group peer hidden text-sidebar-foreground md:block"
      data-state={state}
      data-collapsible={state === 'collapsed' ? collapsible : ''}
      data-variant={variant}
      data-side={side}
      data-slot="sidebar"
    >
      <div
        data-slot="sidebar-gap"
        className={cn(
          'relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear',
          'group-data-[collapsible=offcanvas]:w-0',
          'group-data-[side=right]:rotate-180',
          variant === 'floating' || variant === 'inset'
            ? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]'
            : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon)',
        )}
      />
      <div
        data-slot="sidebar-container"
        data-side={side}
        className={cn(
          'fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear data-[side=left]:left-0 data-[side=left]:group-data-[collapsible=offcanvas]:-left-(--sidebar-width) data-[side=right]:right-0 data-[side=right]:group-data-[collapsible=offcanvas]:-right-(--sidebar-width) md:flex',
          variant === 'floating' || variant === 'inset'
            ? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]'
            : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l',
          className,
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className="flex size-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:shadow-sm group-data-[variant=floating]:ring-1 group-data-[variant=floating]:ring-sidebar-border"
        >
          {children}
        </div>
      </div>
    </div>
  )
}

export function SidebarTrigger({
  className,
  onPress,
  ...props
}: ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      isIconOnly
      aria-label="Toggle Sidebar"
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      size="sm"
      variant="tertiary"
      className={className}
      onPress={(event) => {
        onPress?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeftIcon className="size-4" />
    </Button>
  )
}

export function SidebarRail({ className, ...props }: ComponentProps<'button'>) {
  const { toggleSidebar } = useSidebar()

  return (
    <button
      type="button"
      data-sidebar="rail"
      data-slot="sidebar-rail"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      title="Toggle Sidebar"
      className={cn(
        'absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:inset-s-1/2 after:w-[2px] hover:after:bg-sidebar-border sm:flex',
        'in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize',
        '[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize',
        'group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full hover:group-data-[collapsible=offcanvas]:bg-sidebar',
        '[[data-side=left][data-collapsible=offcanvas]_&]:-right-2',
        '[[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
        className,
      )}
      {...props}
    />
  )
}

export function SidebarInset({
  className,
  children,
  ...props
}: ComponentProps<'main'>) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        'ambient relative flex w-full flex-1 flex-col bg-background md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2',
      )}
      {...props}
    >
      <div className={cn('z-1 flex w-full flex-1 flex-col', className)}>
        {children}
      </div>
    </main>
  )
}

export function SidebarHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn('flex flex-col gap-2 p-2', className)}
      {...props}
    />
  )
}

export function SidebarFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn('flex flex-col gap-2 p-2', className)}
      {...props}
    />
  )
}

export function SidebarSeparator({
  className,
  ...props
}: ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="sidebar-separator"
      data-sidebar="separator"
      className={cn('mx-2 w-auto bg-sidebar-border', className)}
      {...props}
    />
  )
}

export function SidebarContent({
  className,
  children,
  ...props
}: ComponentProps<'div'>) {
  return (
    <ScrollShadow
      hideScrollBar
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-0 overflow-auto group-data-[collapsible=icon]:overflow-hidden',
        className,
      )}
      {...props}
    >
      {children}
    </ScrollShadow>
  )
}

export function SidebarGroup({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn('relative flex w-full min-w-0 flex-col p-2', className)}
      {...props}
    />
  )
}

export function SidebarGroupLabel({
  className,
  asChild,
  children,
  ...props
}: WithAsChild<ComponentProps<'div'>>) {
  const baseClassName = cn(
    'flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 ring-sidebar-ring outline-none transition-[margin,opacity] duration-200 ease-linear group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0 focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
    className,
  )

  if (asChild) {
    const slot = renderAsChild(children, {
      ...props,
      'data-slot': 'sidebar-group-label',
      'data-sidebar': 'group-label',
      className: baseClassName,
    } as ComponentProps<'div'> & {
      'data-slot': string
      'data-sidebar': string
    })

    if (slot) return slot
  }

  return (
    <div
      data-slot="sidebar-group-label"
      data-sidebar="group-label"
      className={baseClassName}
      {...props}
    >
      {children}
    </div>
  )
}

export function SidebarGroupAction({
  className,
  asChild,
  children,
  ...props
}: WithAsChild<ComponentProps<'button'>>) {
  const baseClassName = cn(
    'absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-none transition-transform group-data-[collapsible=icon]:hidden after:absolute after:-inset-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0',
    className,
  )

  if (asChild) {
    const slot = renderAsChild(children, {
      ...props,
      'data-slot': 'sidebar-group-action',
      'data-sidebar': 'group-action',
      className: baseClassName,
    } as ComponentProps<'button'> & {
      'data-slot': string
      'data-sidebar': string
    })

    if (slot) return slot
  }

  return (
    <button
      type="button"
      data-slot="sidebar-group-action"
      data-sidebar="group-action"
      className={baseClassName}
      {...props}
    >
      {children}
    </button>
  )
}

export function SidebarGroupContent({
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn('w-full text-sm', className)}
      {...props}
    />
  )
}

export function SidebarMenu({ className, ...props }: ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn('flex w-full min-w-0 flex-col gap-0', className)}
      {...props}
    />
  )
}

export function SidebarMenuItem({ className, ...props }: ComponentProps<'li'>) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn('group/menu-item relative', className)}
      {...props}
    />
  )
}

type SidebarMenuButtonVariant = 'default' | 'outline'
type SidebarMenuButtonSize = 'default' | 'sm' | 'lg'

export function sidebarMenuButtonClasses({
  variant = 'default',
  size = 'default',
}: {
  variant?: SidebarMenuButtonVariant
  size?: SidebarMenuButtonSize
} = {}) {
  return cn(
    'peer/menu-button group/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm ring-sidebar-ring outline-none transition-[width,height,padding] group-has-data-[sidebar=menu-action]/menu-item:pr-8 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate',
    variant === 'outline'
      ? 'bg-background shadow-[0_0_0_1px_var(--color-sidebar-border)] hover:shadow-[0_0_0_1px_var(--color-sidebar-accent)]'
      : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
    size === 'sm' && 'h-7 text-xs',
    size === 'default' && 'h-8 text-sm',
    size === 'lg' && 'h-12 text-sm group-data-[collapsible=icon]:p-0!',
  )
}

type SidebarMenuButtonProps = WithAsChild<ComponentProps<'button'>> & {
  isActive?: boolean
  variant?: SidebarMenuButtonVariant
  size?: SidebarMenuButtonSize
  tooltip?: ReactNode
}

export function SidebarMenuButton({
  asChild,
  isActive = false,
  variant = 'default',
  size = 'default',
  tooltip,
  className,
  children,
  ...props
}: SidebarMenuButtonProps) {
  const { isMobile, state } = useSidebar()
  const baseClassName = cn(
    sidebarMenuButtonClasses({ variant, size }),
    className,
  )

  let trigger: ReactElement | null = null

  if (asChild) {
    trigger = renderAsChild(children, {
      ...props,
      'data-slot': 'sidebar-menu-button',
      'data-sidebar': 'menu-button',
      'data-size': size,
      'data-active': isActive,
      className: baseClassName,
    } as ComponentProps<'button'> & {
      'data-slot': string
      'data-sidebar': string
      'data-size': string
      'data-active': boolean
    })
  }

  if (!trigger) {
    trigger = (
      <button
        type="button"
        data-slot="sidebar-menu-button"
        data-sidebar="menu-button"
        data-size={size}
        data-active={isActive}
        className={baseClassName}
        {...props}
      >
        {children}
      </button>
    )
  }

  if (!tooltip || state !== 'collapsed' || isMobile) {
    return trigger
  }

  return (
    <Tooltip delay={300}>
      {trigger}
      <Tooltip.Content placement="right">{tooltip}</Tooltip.Content>
    </Tooltip>
  )
}

export function SidebarMenuAction({
  className,
  asChild,
  showOnHover = false,
  children,
  ...props
}: WithAsChild<ComponentProps<'button'>> & { showOnHover?: boolean }) {
  const baseClassName = cn(
    'absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-none transition-transform group-data-[collapsible=icon]:hidden peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1 after:absolute after:-inset-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0',
    showOnHover &&
      'group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground aria-expanded:opacity-100 md:opacity-0',
    className,
  )

  if (asChild) {
    const slot = renderAsChild(children, {
      ...props,
      'data-slot': 'sidebar-menu-action',
      'data-sidebar': 'menu-action',
      className: baseClassName,
    } as ComponentProps<'button'> & {
      'data-slot': string
      'data-sidebar': string
    })

    if (slot) return slot
  }

  return (
    <button
      type="button"
      data-slot="sidebar-menu-action"
      data-sidebar="menu-action"
      className={baseClassName}
      {...props}
    >
      {children}
    </button>
  )
}

export function SidebarMenuBadge({
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cn(
        'pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium text-sidebar-foreground tabular-nums select-none group-data-[collapsible=icon]:hidden peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground',
        className,
      )}
      {...props}
    />
  )
}

export function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: ComponentProps<'div'> & { showIcon?: boolean }) {
  const [width] = useState(() => `${Math.floor(Math.random() * 40) + 50}%`)

  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn('flex h-8 items-center gap-2 rounded-md px-2', className)}
      {...props}
    >
      {showIcon && (
        <Skeleton
          data-sidebar="menu-skeleton-icon"
          className="size-4 rounded-md"
        />
      )}
      <Skeleton
        data-sidebar="menu-skeleton-text"
        className="h-4 max-w-(--skeleton-width) flex-1"
        style={{ '--skeleton-width': width } as CSSProperties}
      />
    </div>
  )
}

export function SidebarMenuSub({ className, ...props }: ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      className={cn(
        'mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5 group-data-[collapsible=icon]:hidden',
        className,
      )}
      {...props}
    />
  )
}

export function SidebarMenuSubItem({
  className,
  ...props
}: ComponentProps<'li'>) {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      className={cn('group/menu-sub-item relative', className)}
      {...props}
    />
  )
}

type SidebarMenuSubButtonProps = WithAsChild<ComponentProps<'a'>> & {
  size?: 'sm' | 'md'
  isActive?: boolean
}

export function SidebarMenuSubButton({
  asChild,
  size = 'md',
  isActive = false,
  className,
  children,
  ...props
}: SidebarMenuSubButtonProps) {
  const baseClassName = cn(
    'flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground ring-sidebar-ring outline-none group-data-[collapsible=icon]:hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[size=md]:text-sm data-[size=sm]:text-xs data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground',
    className,
  )

  if (asChild) {
    const slot = renderAsChild(children, {
      ...props,
      'data-slot': 'sidebar-menu-sub-button',
      'data-sidebar': 'menu-sub-button',
      'data-size': size,
      'data-active': isActive,
      className: baseClassName,
    } as ComponentProps<'a'> & {
      'data-slot': string
      'data-sidebar': string
      'data-size': string
      'data-active': boolean
    })

    if (slot) return slot
  }

  return (
    <a
      data-slot="sidebar-menu-sub-button"
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={baseClassName}
      {...props}
    >
      {children}
    </a>
  )
}
