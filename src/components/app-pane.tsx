import { cn } from '@/lib/cn'
import type { CSSProperties, ReactNode } from 'react'

/**
 * The desktop-style shell frame: a canvas with elevated panes inset into it.
 *
 * The shell used to be one continuous sheet divided by hairlines. This is the
 * other structural claim — regions are objects sitting on a surface, and the
 * canvas showing between them is what separates them. There is no border
 * anywhere in this file, and there should not be one: a pane that also carries
 * an outline reads as a card drawn on top of a card.
 *
 * Two arithmetic facts this depends on, both asserted by
 * `pnpm check:shell-elevation` against the rendered page rather than trusted:
 *
 *  1. `--color-background-body` (canvas) and `--color-background-surface`
 *     (pane) must resolve to *different* values. If a theme collapses them,
 *     every pane silently becomes invisible and the app looks like one flat
 *     sheet with mysterious gaps in it.
 *  2. The gutter has to be real space. A shadow with no gap to cast into is a
 *     smudge along an edge.
 *
 * Below `md` the frame is dropped entirely: a phone has no room to spend on a
 * gutter, so panes go full-bleed and the canvas stops being visible. That is
 * why the radius, the shadow, and the inset are all `md:`-prefixed rather than
 * unconditional.
 */

/** Canvas gutter, matched to the gap between panes so the rhythm is uniform. */
const GUTTER = 'md:gap-2 md:p-2 pl-0!'

type AppPaneGroupProps = {
  children: ReactNode
  className?: string
}

/**
 * The canvas. Owns the gutter around and between the panes it holds, so a
 * route never hand-rolls its own inset and the seams stay one width.
 *
 * Every authenticated route's content should be inside one of these, including
 * single-pane routes — the gutter is what makes a lone pane read as inset
 * rather than as the page itself.
 */
export function AppPaneGroup({ children, className }: AppPaneGroupProps) {
  return (
    <div
      // Marked so `pnpm check:shell-elevation` can find the frame in the built
      // DOM. Class names are hashed and the fills are theme variables, so
      // there is otherwise nothing stable to assert against.
      data-app-pane-group=""
      className={cn(
        'flex h-full min-h-0 w-full overflow-hidden',
        GUTTER,
        className,
      )}
    >
      {children}
    </div>
  )
}

type AppPaneElement = 'div' | 'aside' | 'section'

type AppPaneProps = {
  children: ReactNode
  className?: string
  /**
   * Landmark element for the pane. Defaults to a plain `div`; pass `aside` or
   * `section` when the pane is a real landmark and give it a `label`.
   */
  as?: AppPaneElement
  /** Accessible name, applied as `aria-label`. Required by `aside`/`section`. */
  label?: string
  /** Fixed width in px. Omit for a pane that should fill the remaining space. */
  width?: number
  style?: CSSProperties
}

/**
 * One elevated region of the shell.
 *
 * Carries the fill, the radius, the lift, and the scroll containment. Content
 * inside is edge-to-edge — the pane has no padding of its own, because its
 * children (a 64px header, a scroll region, a composer) each own their insets
 * and a pane-level pad would double them.
 *
 * `overflow-hidden` is not cosmetic here: it is what clips a child's square
 * corners to the pane's radius, so a header rule or a selected row stops at
 * the curve instead of poking through it.
 */
export function AppPane({
  children,
  className,
  as: Element = 'div',
  label,
  width,
  style,
}: AppPaneProps) {
  return (
    <Element
      data-app-pane=""
      aria-label={label}
      style={width === undefined ? style : { ...style, width }}
      className={cn(
        'bg-surface flex min-h-0 min-w-0 flex-col overflow-hidden',
        // Full-bleed on phones; an object on the canvas from `md` up. The
        // shadow is the theme's own `--shadow-low`, which in dark mode also
        // carries a 1px inset rim — that rim is what gives a pane an edge
        // against a dark canvas, where a drop shadow alone reads as nothing.
        'md:rounded-lg md:shadow-sm',
        // A pane with a fixed width must not be squeezed by its siblings;
        // one that fills should take everything that is left.
        width === undefined ? 'flex-1' : 'shrink-0',
        className,
      )}
    >
      {children}
    </Element>
  )
}
