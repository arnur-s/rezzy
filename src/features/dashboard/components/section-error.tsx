import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'

type Props = {
  message: string
  onRetry: () => void
  isRetrying?: boolean
}

/** Inline per-section failure: names the problem, offers the recovery. */
export function SectionError({ message, onRetry, isRetrying = false }: Props) {
  return (
    <div className="bg-error/5 flex items-center justify-between gap-2 rounded-lg px-3 py-2">
      <span className="text-error text-sm">{message}</span>
      <Button
        label={m.common_retry()}
        size="sm"
        variant="ghost"
        onClick={onRetry}
        isLoading={isRetrying}
      />
    </div>
  )
}
