type Props = {
  label: string
}

/**
 * Day marker in the transcript: a quiet pill, subtle through colour alone — no
 * rule, no border, muted text — so it never competes with the messages.
 *
 * The fill is `bg-muted`, not `bg-surface`. The transcript has no background of
 * its own, so the pill sits directly on the page, and this theme resolves
 * surface and body to the same value — a surface fill would paint the page
 * colour onto the page and the pill would vanish. `bg-muted` is the one neutral
 * that reads as a step off the page in both modes.
 *
 * Restyle this with colour only. The list measures row heights for scroll
 * anchoring, so changing padding, border, or type size here perturbs the pin.
 */
export function DateSeparator({ label }: Props) {
  return (
    <div className="flex justify-center py-1.5">
      <span className="bg-muted text-secondary rounded-full px-2.5 py-0.5 text-sm font-medium">
        {label}
      </span>
    </div>
  )
}
