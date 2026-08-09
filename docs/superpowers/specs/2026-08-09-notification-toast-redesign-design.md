# Notification toast redesign

Date: 2026-08-09
Status: approved, not yet implemented

## Problem

The in-app message notification toast (`src/features/notifications/components/message-notification.tsx`) carries more chrome than a toast should:

- an "Open thread" primary button, which is the only way to reach the conversation
- a workspace-name pill
- a "Show full message" expander that grows the toast in place

It also loses messages. The toast is keyed `uniqueID: conversationId` with `collisionBehavior: 'overwrite'`, so a second message from the same conversation replaces the first and the first is never seen.

Separately, the type hierarchy has collapsed. Contact name, timestamp, and preview all render at 12px, because `text-sm` and `text-xs` resolve to the same size under `neutralTheme` (`DESIGN.md`, Known drift #1). Hierarchy is carried by weight alone.

## Goals

1. Reduce the toast to avatar, name, preview, relative time.
2. Make the toast body itself the navigation target; remove the button.
3. Group consecutive messages from one conversation into a single toast that expands to show them all.
4. Restore the two-tier type hierarchy on this surface.

## Non-goals

- Changing which notifications are presented. `shouldPresentInApp`, the deduper, and the tab coordinator are untouched.
- Changing cross-conversation stacking. Different conversations already produce separate toasts (Astryx `addToast` appends whenever `uniqueID` differs, `maxVisible` 5). That behavior is correct and stays.
- Changing the service-worker/OS notification path.
- Changing the notifications route or the header bell (`notifications-page.tsx`, `unread-notification-item.tsx`).

## Constraints discovered in the dependency

These come from reading `@astryxdesign/core@0.1.8` source and are load-bearing for the design.

- **The toast surface is inverted.** `Toast` renders on `--color-background-inverted` and wraps `body` in `<MediaTheme mode={dark|light}>`, which sets `data-astryx-media` and lets the theme override color tokens for descendants. Token-backed Tailwind utilities (`text-primary`, `text-secondary`, `bg-primary/4`) therefore flip correctly; raw colors would not.
- **The close button is a flex sibling of `body`, not an overlay.** `styles.inner` is a flex row of `content` (`flex: 1`) and `endContent` (`flex-shrink: 0`). It never overlaps the body box, so the existing `pe-6 sm:pe-2` reserve in the body is dead weight and the body may host an absolutely positioned overlay without covering the close button.
- **Overwrite does not fire `onHide`.** `addToast` replaces the matching entry via `prev.map(...)`; only `removeToast` calls `onHide`. A per-conversation store keyed to the toast's lifetime can therefore clear on `onHide` and survive overwrites.
- **Overwrite remounts the toast.** The replacement entry carries a new `id`, which is the React `key`, so the toast replays its `@starting-style` enter transition. This is desirable feedback and requires no code.
- **`light-dark()` tokens flip inside the toast.** The theme's generated CSS
  sets `color-scheme` on `[data-astryx-media]` (pinned by Astryx's own
  `onMediaTokens.test.ts`), and `--color-background-surface` is
  `light-dark(#FFFFFF, #1F1F22)`. So `ring-surface` on the platform badge
  resolves to the dark value inside the toast body and punches the badge out
  correctly without special handling.
- **Auto-hide already pauses on hover and focus.** `Toast` binds `onMouseEnter`/`onMouseLeave` and `onFocusCapture`/`onBlurCapture` to its pause/resume timers, and pauses on `window` blur. Hovering to read an expanded group, or tapping the expand chip, both hold the toast open with no extra code.

## Design

### Anatomy

Collapsed, single message:

```
┌────────────────────────────────────────────────┐
│  ⬤▸   Анна Петрова                 2м      ✕   │
│  ⌞tg⌟  А когда будет доставка, подскажите?     │
└────────────────────────────────────────────────┘
```

Collapsed, grouped (chip shows the total):

```
┌────────────────────────────────────────────────┐
│  ⬤▸   Анна Петрова  ③              2м      ✕   │
│  ⌞tg⌟  А когда будет доставка, подскажите?     │
└────────────────────────────────────────────────┘
```

Expanded — on hover (fine pointer) or on tapping the chip:

```
┌────────────────────────────────────────────────┐
│  ⬤▸   Анна Петрова  ③              2м      ✕   │
│  ⌞tg⌟  Здравствуйте!                      5м   │
│        Хотел уточнить по заказу           3м   │
│        А когда будет доставка, подскажите? 2м  │
└────────────────────────────────────────────────┘
```

Older messages occupy a collapsing region **above** the newest message, so the
newest never moves and the toast grows downward. Newest-at-bottom matches the
reading order of the thread itself.

### Element inventory

| Element | Today | After |
| --- | --- | --- |
| Avatar 40px + `PlatformIcon` corner badge | present | unchanged |
| Contact name | `text-sm font-semibold text-primary` (12px) | `text-base font-semibold text-primary` (14px) |
| Relative time | `text-xs text-secondary tabular-nums` | `text-sm text-secondary tabular-nums` (same 12px, correct tier name) |
| Newest preview | `text-sm text-primary/80`, `line-clamp-2` | `text-base text-secondary`, `line-clamp-2` |
| Older previews | — | `text-base text-secondary`, `truncate`, each with its own time |
| Count chip | — | new, rendered only when the group holds 2+ |
| `pe-6 sm:pe-2` reserve | present | removed |
| Workspace pill | present | removed |
| "Show full message" | present | removed |
| "Open thread" button | present | removed |

The type moves follow `DESIGN.md`'s Two-Tier Rule: name and preview are body
(14px), timestamps are metadata (12px floor). `text-primary/80` becomes
`text-secondary` per the Opacity Step Is Mode-Asymmetric Rule — a designed tone
rather than an arithmetic one, which matters more here because the toast is a
third (inverted) surface where neither mode's contrast figure applies directly.

The bell plate in `previewMode: 'hidden'` moves from `rounded-3xl` (an
unremapped Tailwind default) to `rounded-xl` (`--radius-page`), matching the
avatar it replaces.

### Navigation

The body hosts an absolutely positioned `<button>` at `inset-0` that navigates
to the thread and dismisses the toast. The count chip sits above it with
`relative z-10`; everything else is inert to pointer events.

This avoids nesting interactive elements. The overlay is `inset-0` of the body
box only, and Astryx's close button lives outside that box, so the two never
overlap and paint order is irrelevant.

Press feedback reuses `listItemStyle` from `src/components/list.tsx` so the
toast presses like every other row in the product: `hover:bg-primary/4`,
`active:scale-[0.98]`, `focus-visible:ring-2 focus-visible:ring-accent`,
`transition motion-reduce:transition-none`.

Accessible name follows `unread-notification-item.tsx`: name, preview, and time
joined into one label on the overlay button, with the visual children left
decorative.

### Grouping

A module-level store maps `conversationId` to the messages currently represented
by that conversation's live toast.

- On each arriving notification, append to the conversation's group and cap at
  the 5 newest.
- Re-show the toast with the whole group. Astryx's `overwrite` swaps the entry
  in place, so exactly one toast per conversation remains.
- Clear the conversation's group in `onHide`. Because overwrite does not fire
  `onHide`, a group lives exactly as long as its toast.
- The chip displays the true total, which may exceed the 5 rendered rows.

Grouping is therefore bounded by the toast's own lifetime: a message arriving
more than `autoHideDuration` (8s) after the previous one starts a fresh toast.
That is intended.

`previewMode: 'hidden'` opts out entirely — no names, no bodies, no chip, no
grouping, since a visible count would leak how many messages arrived.

### Expansion

State is `expanded || hover`, expressed as a `data-expanded` attribute plus
`group-hover:`. The installed Tailwind is 4.1.18, which gates `hover:` behind
`@media (hover: hover)`, so a tap on a phone cannot leave the row stuck open and
no explicit media query is needed.

The collapsing region animates `grid-template-rows: 0fr → 1fr` over 200ms on the
theme's `--ease-standard`, with opacity on the inner content so text does not
smear during collapse, and `motion-reduce:transition-none`. A transition rather
than a keyframe animation, so a hover-out mid-expand retargets from the current
position instead of restarting.

No other motion is added. Astryx's existing enter (`@starting-style`,
`opacity 0` + `translateY(8px)`, `--duration-fast` 125ms) and exit (row collapse)
are already correct and stay untouched.

### Copy

Retired keys (no other consumer):

- `notifications_open_thread`
- `notifications_show_full_message`

New keys, both requiring Russian `one` / `few` / `many` variants per
`AGENTS.md`:

- `notifications_group_expand` — the chip's accessible name when collapsed
  ("ещё 1 сообщение" / "ещё 2 сообщения" / "ещё 5 сообщений")
- `notifications_group_collapse` — the chip's accessible name when expanded

The chip's visible text is a bare numeral, so it needs no translation.

## Files

| File | Change |
| --- | --- |
| `src/features/notifications/components/message-notification.tsx` | rewritten body; `showMessageNotificationToast` gains group assembly and `onHide` cleanup |
| `src/features/notifications/components/notification-preview.tsx` | deleted — only consumer was the expander |
| `src/features/notifications/utils/notification-group-store.ts` | new |
| `src/features/notifications/utils/notification-group-store.test.ts` | new |
| `src/features/notifications/components/message-notification.test.tsx` | updated for the new anatomy and grouping |
| `messages/en.json`, `messages/ru.json` | two keys out, two plural keys in |

`buildNotificationPreview` keeps its 140-character truncation; without the
expander the `truncated` and `fullText` outputs simply go unused by this
component. It is left alone rather than changed, since its tests pin the current
contract and no other behavior depends on the change.

## Testing

Unit (`vitest` + Testing Library):

- renders name, preview, and relative time; renders no "Open thread" button and
  no workspace pill
- the overlay button calls the navigate callback and dismisses
- `previewMode: 'hidden'` renders the generic body with no chip and no grouping
- the group store appends, caps at 5, clears by conversation, and keeps
  conversations independent
- a second notification for the same conversation renders both messages
- a notification for a different conversation does not join the first's group

Plural coverage: add the two new keys to `src/lib/message-plurals.test.ts`.

Length budget: the contact name and the chip share a fixed-width row, so add the
name to `src/lib/message-lengths.test.ts` if it is not already budgeted.

Commands: `pnpm typecheck`, `pnpm test`, `pnpm lint`.

Manual, in a real browser — jsdom has no layout, so the clamps, the overlay
geometry, and the expand animation are invisible to the unit suite:

- Russian locale, phone width: toast at top center, two-line clamp holds, chip
  reachable by tap, expand animates, second tap on the body navigates
- Desktop: hover expands and pauses auto-hide; leaving collapses and resumes
- A toast raised over an open modal is still visible (regression on
  `AppLayerProvider`'s top-layer promotion)
- Light and dark mode, since the toast surface is inverted in both

## Risks

- **A grouped toast can grow tall.** Five one-line rows plus a two-line newest
  message is roughly 8 lines. At phone width, top-center, that is acceptable but
  should be eyeballed before shipping; the cap can drop to 3 if it reads heavy.
- **Toasts beyond `maxVisible` are unmounted, not queued.** Astryx renders
  `toasts.slice(-maxVisible)`, so a sixth conversation's toast unmounts the
  oldest, which stops its auto-hide timer; it reappears when others clear. This
  is pre-existing Astryx behavior, out of scope here, noted so it is not
  mistaken for a regression introduced by grouping.
