import { m } from '@/paraglide/messages'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Suspense, lazy } from 'react'

/**
 * Emoji picker, loaded only when it is opened.
 *
 * `@emoji-mart/data` is a ~1.6 MB JSON blob of every emoji with its keywords,
 * and `@emoji-mart/react` pulls the picker UI with it. Imported statically they
 * land in the conversation chunk, so opening any thread paid for a panel most
 * sessions never open. Gating the *render* was not enough: a static import is a
 * bundling decision, not a runtime one.
 *
 * Both the component and its data resolve on first open and stay cached for the
 * rest of the session.
 */
const EmojiMartPicker = lazy(async () => {
  const [{ default: Picker }, { default: data }] = await Promise.all([
    import('@emoji-mart/react'),
    import('@emoji-mart/data'),
  ])

  return {
    default: function LoadedPicker({
      onEmojiSelect,
    }: {
      onEmojiSelect: (emoji: { native: string }) => void
    }) {
      return (
        <Picker data={data} onEmojiSelect={onEmojiSelect} theme="auto" />
      )
    },
  }
})

export function EmojiPicker({
  onEmojiSelect,
}: {
  onEmojiSelect: (emoji: { native: string }) => void
}) {
  return (
    <Suspense
      fallback={
        <div
          className="flex h-72 w-[352px] items-center justify-center"
          aria-label={m.inbox_composer_emoji_label()}
        >
          <Spinner size="md" />
        </div>
      }
    >
      <EmojiMartPicker onEmojiSelect={onEmojiSelect} />
    </Suspense>
  )
}
