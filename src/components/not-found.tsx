import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { useNavigate } from '@tanstack/react-router'
import { CompassIcon } from 'lucide-react'

export function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="flex h-full w-full items-center justify-center">
      <EmptyState
        icon={<CompassIcon className="text-secondary size-8" />}
        title={m.not_found_title()}
        description={m.not_found_description()}
        actions={
          <Button
            label={m.not_found_go_home_link()}
            variant="secondary"
            onClick={() => void navigate({ to: '/' })}
          />
        }
      />
    </div>
  )
}
