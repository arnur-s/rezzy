import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

/**
 * A home section's heading, and the one place its rank is expressed.
 *
 * Every section used to render an identical `text-sm font-semibold` h2, so the
 * urgent personal queue and the ambient workspace inventory arrived with the
 * same visual weight and the page had no shape. Rank is carried the way the
 * design system carries everything else — by weight and color, not by size,
 * since 13px is the step these headings live on.
 *
 * `description` is the other half: definitions like "conversations nobody has
 * picked up yet" used to live in a `title` attribute, which is invisible on
 * touch, unreachable by keyboard, and unreliably announced. If a section needs
 * explaining, it explains itself on the page.
 */

type Props = {
  id: string
  title: string
  /** Visible one-line explanation of what qualifies for this section. */
  description?: string
  /**
   * `primary` for the section the page exists to serve, `secondary` for
   * supporting context below it.
   */
  rank?: 'primary' | 'secondary'
  /** Optional controls rendered opposite the title. */
  actions?: ReactNode
}

export function SectionHeading({
  id,
  title,
  description,
  rank = 'secondary',
  actions,
}: Props) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
      <div className="min-w-0">
        <h2
          id={id}
          className={cn(
            'text-sm',
            rank === 'primary'
              ? 'text-primary font-semibold'
              : 'text-secondary font-medium',
          )}
        >
          {title}
        </h2>
        {description ? (
          <p className="text-secondary mt-0.5 text-sm">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center justify-end gap-1">
          {actions}
        </div>
      ) : null}
    </div>
  )
}
