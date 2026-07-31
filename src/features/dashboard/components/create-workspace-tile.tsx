import { m } from '@/paraglide/messages'
import { Card } from '@astryxdesign/core/Card'
import { PlusIcon } from 'lucide-react'

/**
 * The one shape for "add a workspace" on a populated home.
 *
 * Creating a workspace used to wear three costumes across adjacent lifecycle
 * states: a centered `EmptyState` button at zero, a ghost button in the section
 * header at one, and this dashed tile at two or more. A user who adds their
 * second workspace should not have to relearn where the action lives, so the
 * populated states now share this tile and only the true empty state differs,
 * where the action is the whole point of the screen rather than an addition to
 * it.
 */
export function CreateWorkspaceTile({ onCreate }: { onCreate: () => void }) {
  return (
    <button
      type="button"
      onClick={onCreate}
      className="group rounded-lg text-left outline-none transition focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.99] motion-reduce:transition-none"
    >
      {/* `transparent` + a dashed border, not `muted`. In light mode the card
          background is #FFFFFF (raised above the page) while the muted fill is
          #D8E2E9 (recessed below it), so a muted tile sitting beside real
          workspace cards pointed elevation in two directions at once. An empty
          slot should read as an outline, which is also the pattern the
          channel-connect surfaces already use. */}
      <Card variant="transparent" height="100%">
        <div className="border-strong/60 group-hover:border-strong flex h-full min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-dashed transition-colors motion-reduce:transition-none">
          <span
            aria-hidden="true"
            className="bg-primary/5 text-secondary flex size-8 items-center justify-center rounded-full"
          >
            <PlusIcon className="size-4" />
          </span>
          <span className="text-secondary group-hover:text-primary text-sm font-medium transition-colors">
            {m.dashboard_empty_cta()}
          </span>
        </div>
      </Card>
    </button>
  )
}
