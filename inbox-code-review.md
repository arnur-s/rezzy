Inbox Code Review
The overall architecture is solid — Feature-Sliced Design is respected, TanStack Query is used correctly with stable keys and optimistic updates, realtime sync is clean, and the read cursor/scroll behavior is genuinely sophisticated. What follows are the issues that will hurt you, ordered by impact.

1. Channel-specific dispatch hardcoded in the send function — blocks every new channel
   api/messages.ts:142-224

const isTelegram = channelType === 'telegram'
// ...
if (!isTelegram) {
return inserted
}
// invoke send-telegram-message Edge Function
This is the "add a channel → add another if block" trap. Adding Instagram means isInstagram, then isWhatsApp, etc. The client should not know the delivery mechanism.

Best approach: The client inserts the message row and calls one generic edge function (e.g. send-outbound-message) that routes internally by channel.type. Or use a Postgres trigger/queue. Either way, the client path becomes channel-agnostic and never changes when you add a channel. The Telegram-specific mapSendTelegramInvokeError naming leaks the same assumption.

2. ChatInput file accept types are hardcoded — can't restrict per channel
   components/message-thread/chat-input.tsx:239-242

<input
type="file"
accept="image/_,video/_,application/pdf"
Instagram only supports images/videos in most contexts. WhatsApp has its own MIME restrictions. This string must be a prop derived from channel capabilities, otherwise every new channel requires editing ChatInput internals.

Best approach: Define a CHANNEL_CAPABILITIES record per channel type:

const CHANNEL_CAPABILITIES: Record<ChannelType, {
acceptedMimeTypes: string
maxFileSizeBytes: number
supportsAttachments: boolean
}> = {
telegram: { acceptedMimeTypes: 'image/_,video/_,audio/_,application/pdf', maxFileSizeBytes: 50_000_000, supportsAttachments: true },
instagram: { acceptedMimeTypes: 'image/_,video/\*', maxFileSizeBytes: 8_000_000, supportsAttachments: true },
whatsapp: { ... },
email: { ... },
}
MessageComposer reads from this and passes the derived constraints to ChatInput as props.

3. Voice recognition language hardcoded to Russian
   components/message-thread/chat-input.tsx:117

lang: 'ru-RU',
This is plainly broken for any non-Russian workspace. Should be navigator.language at minimum, or a workspace/user setting.

4. MessageListView and VirtualizedMessageList duplicate the same scroll state machine
   components/message-thread/message-list.tsx:196-422 vs components/message-thread/virtualized-message-list.tsx:79-397

Both components copy the same block of refs and effects:

stickToBottomRef, initialScrollDoneRef, lastLenRef, lastFirstIdRef, lastLastIdRef, markedReadMessageIdRef
onReadAnchorVisibleRef, commitReadIfEligibleRef, hasUnreadInboundRef, currentUserIdRef
Append/prepend detection logic, new-messages button state, scroll-follow behavior
A bug in either path needs fixing in both. This has already happened at least once (the virtualized version diverged slightly in append handling).

Best approach: Extract a useMessageScrollBehavior(props) hook that owns all the scroll state machine. Both MessageListView and VirtualizedMessageList call it and receive commands like scrollToBottom() / scrollToIndex() as callbacks they supply to the hook.

5. No optimistic update when sending a message
   [hooks/use-messages.ts — useSendMessage]

The user waits for the full round trip (upload → insert → edge function invoke → re-fetch) before their message appears. For Telegram this is 3 DB round trips. On a slow connection this feels broken.

Best approach: Optimistically append the message to the infinite query cache immediately with status: 'sending', then replace it with the server response. TanStack Query's onMutate/onSettled pattern supports this exactly.

6. useConversationsRealtime does a full list refetch on INSERT
   [hooks/use-conversations-realtime.ts]

Every inbound message triggers a full conversation list refetch. This is fine now but will visibly thrash at scale (dozens of concurrent active conversations).

UPDATE events are already handled by patching the cache. INSERT should do the same — fetch only the new conversation row and prepend it, the same way appendMessageToNewestPage works in message-pages.ts.

7. Commented-out dead code carried in ConversationList
   components/conversation-list/conversation-list.tsx:29-32, 77-86, 97-99, 209-219

The channel type/ID filter is commented out in props, in the useMemo body, in the filter predicate, and in JSX — across the whole file. This is noise that makes the file harder to read and gives false signals about what the component does.

If the feature isn't ready, remove it entirely. Bring it back via a proper branch when you implement it.

8. Client-side search won't scale
   components/conversation-list/conversation-list.tsx:88-105

The search filter runs .filter() over the full conversations array in-client. This is fine today but breaks once a workspace has hundreds of conversations (the full list is fetched upfront). Server-side search with a debounced query is the production answer for a CRM.

This is also the reason the channel filter was probably commented out — the client filtering approach doesn't compose well with server state.

9. Storage upload has no rollback path
   api/messages.ts:153-157

If the Storage upload succeeds but the DB insert fails, the file is orphaned in chat-media forever. Not a crash bug, but it accumulates garbage.

The minimal fix: catch the insert error and call supabase.storage.from(CHAT_MEDIA_BUCKET).remove([storagePath]) before re-throwing. A more robust fix is to make the Storage path the source of truth only after a successful insert (which is what the current UUID-path approach is trying to set up — it just doesn't clean up on failure).

10. initialScrollTarget recomputed on every messages update
    components/message-thread/message-thread.tsx:101-104

const initialScrollTarget = useMemo(
() => getConversationInitialScrollTarget({ messages }),
[messages],
)
The value is only used once (at mount, guarded by initialScrollDoneRef). Recomputing it on every realtime update is harmless but wasteful. Freeze it with a ref:

const initialScrollTargetRef = useRef<InitialScrollTarget | null>(null)
initialScrollTargetRef.current ??= getConversationInitialScrollTarget({ messages })
Channel extensibility — what the clean version looks like
Adding Instagram should require:

Adding 'instagram' to CHANNEL_CAPABILITIES (new file)
Adding the edge function send-instagram-message server-side
Zero changes to sendOutboundMessage, ChatInput, or MessageComposer
Right now it requires changes to sendOutboundMessage (new if branch), ChatInput (new accept types), and potentially MessageComposer (channel-specific UI hints). The gap between "adding a channel" and "editing shared code" is where multi-channel implementations quietly accumulate bugs.
