type Props = {
  label: string
}

/**
 * Day marker in the transcript. Per the design system, a date separator is a
 * quiet pill — surface fill on the recessed transcript, muted text, no rule and
 * no border — subtle through color alone so it never competes with messages.
 */
export function DateSeparator({ label }: Props) {
  return (
    <div className="flex justify-center py-1.5">
      <span className="bg-surface text-secondary rounded-full px-2.5 py-0.5 text-xs font-medium">
        {label}
      </span>
    </div>
  )
}
