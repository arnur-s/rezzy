import { Skeleton } from '@astryxdesign/core/Skeleton'
import { cn } from '@/lib/cn'
import { TRANSCRIPT_MEASURE } from './transcript-measure'

type SkeletonBubble = { width: number; height: number }
type SkeletonRun = {
  direction: 'inbound' | 'outbound'
  bubbles: ReadonlyArray<SkeletonBubble>
}

/**
 * A plausible tail of a conversation rather than alternating bars: consecutive
 * same-direction messages arrive in runs, so the placeholder groups them the
 * way the transcript will and carries one timestamp per run.
 *
 * Heights match a real bubble — 12px padding-block around one 20px line (44),
 * or two (64).
 */
const RUNS: ReadonlyArray<SkeletonRun> = [
  {
    direction: 'inbound',
    bubbles: [
      { width: 224, height: 44 },
      { width: 168, height: 44 },
    ],
  },
  { direction: 'outbound', bubbles: [{ width: 152, height: 44 }] },
  { direction: 'inbound', bubbles: [{ width: 288, height: 64 }] },
  {
    direction: 'outbound',
    bubbles: [
      { width: 208, height: 44 },
      { width: 128, height: 44 },
    ],
  },
]

const AVATAR_SIZE = 32

/**
 * Loading placeholder for the message transcript.
 *
 * Anchored to the bottom, because the transcript opens pinned to its latest
 * message — a top-anchored skeleton would promise content in a place nothing
 * ever appears. Bubbles are pills: `--radius-chat` is 28px on a 44px bubble,
 * so a fully rounded placeholder is the honest silhouette, where Skeleton's
 * largest stepped radius (12px) reads as a different component entirely.
 */
export function MessageThreadSkeleton() {
  // Running index so the shimmer breaks bottom-of-thread first and washes up
  // the column, instead of every bar pulsing in unison.
  let shimmerIndex = 0
  const nextIndex = () => shimmerIndex++

  return (
    <div
      className={cn(TRANSCRIPT_MEASURE, 'flex flex-col gap-5 px-4 py-6 sm:px-6')}
      aria-hidden
    >
      <div className="flex justify-center">
        <Skeleton width={72} height={20} radius="rounded" index={nextIndex()} />
      </div>

      {RUNS.map((run, runIndex) => {
        const isOutbound = run.direction === 'outbound'
        return (
          <div
            key={runIndex}
            className={cn('flex gap-2', isOutbound && 'justify-end')}
          >
            {isOutbound ? null : (
              <Skeleton
                width={AVATAR_SIZE}
                height={AVATAR_SIZE}
                radius="rounded"
                index={nextIndex()}
              />
            )}
            <div
              className={cn(
                'flex flex-col gap-1',
                isOutbound ? 'items-end' : 'items-start',
              )}
            >
              {run.bubbles.map((bubble, bubbleIndex) => (
                <Skeleton
                  key={bubbleIndex}
                  width={bubble.width}
                  height={bubble.height}
                  radius="rounded"
                  index={nextIndex()}
                />
              ))}
              {/* One footer per run, matching the transcript's own rhythm. */}
              <Skeleton width={44} height={10} radius="rounded" index={nextIndex()} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
