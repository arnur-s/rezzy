import { m } from '@/paraglide/messages'
import { cn } from '@/lib/cn'
import { CirclePlayIcon, Share2Icon } from 'lucide-react'
import type {
  ShareMetadata,
  StoryMetadata,
} from '../../schemas/message-metadata'

type Props = {
  share: ShareMetadata | null
  story: StoryMetadata | null
  messageType: 'share' | 'story_reply' | 'story_mention'
  isOutbound: boolean
}

function shareLabel(messageType: Props['messageType'], share: ShareMetadata | null) {
  if (messageType === 'story_reply') return m.inbox_share_story_reply()
  if (messageType === 'story_mention') return m.inbox_share_story_mention()
  if (share?.kind === 'ig_reel' || share?.kind === 'reel') {
    return m.inbox_share_reel()
  }
  return m.inbox_share_post()
}

/**
 * Shared post / reel / story context. Provider CDN URLs are temporary, so the
 * link is best-effort and clearly labeled.
 */
export function MessageShare({ share, story, messageType, isOutbound }: Props) {
  const url = share?.url ?? story?.url ?? null
  const Icon = messageType === 'share' ? Share2Icon : CirclePlayIcon
  const label = shareLabel(messageType, share)

  const body = (
    <span className="flex min-w-0 items-start gap-2 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="flex min-w-0 flex-col">
        <span className="font-medium">{label}</span>
        {share?.title ? (
          <span
            className={cn(
              'truncate text-xs',
              isOutbound ? 'text-on-accent/75' : 'text-primary/60',
            )}
          >
            {share.title}
          </span>
        ) : null}
        {url ? (
          <span
            className={cn(
              'text-xs underline underline-offset-2',
              isOutbound ? 'text-on-accent/75' : 'text-primary/60',
            )}
          >
            {m.inbox_share_open_link()}
          </span>
        ) : null}
      </span>
    </span>
  )

  if (!url) return <div className="p-0.5">{body}</div>

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="block p-0.5 hover:opacity-80"
    >
      {body}
    </a>
  )
}
