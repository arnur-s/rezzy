import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

/**
 * Workspace pane surfaces.
 *
 * The authenticated shell is three tonal layers, not one sheet:
 *
 *   background          the app canvas the sidebar and header sit on
 *   surface             panes floating above it
 *   surface-secondary   recessed regions inside a pane, e.g. the message stream
 *
 * Panes carry **no border**. Separation comes from the canvas showing through
 * the frame's gap, plus the light-mode shadow; in dark mode the canvas is a
 * deep enough tonal step below `--surface` to read on its own. Outlining every
 * pane adds a grey line to a system that already has too many of them.
 *
 * Panes clip their own content so headers and scroll regions round with them.
 */
export const paneStyle = {
  /** An elevated pane on the canvas. Owns its own clipping and scroll context. */
  surface:
    'flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg bg-surface shadow-md md:rounded-xl',
  /** A recessed region inside a pane. Never elevated, never shadowed. */
  recessed: 'bg-muted',
  /**
   * A deliberate work surface lifted back up inside a recessed region (the
   * composer). Borderless like a pane; the shadow and tonal step carry it.
   */
  raised: 'rounded-xl bg-surface shadow-md',
  /**
   * A hairline between adjacent regions *inside* one pane — a pane header and
   * its body, say. This is the only place a line is correct: never around a
   * pane, only within one.
   */
  separator: 'border-border/60',
} as const

interface WorkspacePaneProps {
  children: ReactNode
  className?: string
  /** Renders a semantic <aside> instead of <div>, for supporting panes. */
  as?: 'div' | 'aside'
  'aria-label'?: string
}

export function WorkspacePane({
  children,
  className,
  as = 'div',
  'aria-label': ariaLabel,
}: WorkspacePaneProps) {
  const Component = as
  return (
    <Component className={cn(paneStyle.surface, className)} aria-label={ariaLabel}>
      {children}
    </Component>
  )
}
