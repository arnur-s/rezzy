# Inbox Conversation URL Routing

**Date:** 2026-05-20  
**Status:** Approved

## Goal

Give each conversation a shareable, deep-linkable URL:

```
/workspaces/{workspaceId}/inbox/{conversationId}
```

Visiting `/workspaces/{id}/inbox` with no conversation selected shows the existing empty thread state.

## Approach

Convert `inbox.tsx` from a leaf route into a layout route (matching the `settings.tsx` / `settings/` pattern already in the project). Two minimal child routes register the URL shapes. The layout continues to own all rendering — the 3-pane shell, conversations query, filters, contact panel, and `MessageThread` — reading `conversationId` from the active URL param instead of local state.

## File Changes

### Modified

**`src/routes/_authenticated/workspaces/$id/inbox.tsx`**  
Becomes a layout route. Key changes:

- Remove `selectedId` useState.
- Add `useParams({ strict: false })` to read `conversationId` from the active child URL. Resolves to `null` when on the index route.
- `handleSelect` navigates to `./$conversationId` instead of calling `setSelectedId`.
- `handleBackToList` navigates to `.` (inbox index) instead of calling `setMobilePane`.
- `mobilePane` is derived (no longer state):
  ```ts
  const mobilePane: MobilePane = isContactPanelOpen && selectedConversation
    ? 'contact'
    : conversationId
      ? 'thread'
      : 'list'
  ```
- `<Outlet />` added inside the thread pane div. Children render `null` so this has no visual effect; it is required for TanStack Router to recognise child routes.
- `MessageThread` stays in the layout — no prop threading or context needed.

### New

**`src/routes/_authenticated/workspaces/$id/inbox/index.tsx`**  
Matches `/workspaces/$id/inbox` exactly. Component renders `null`; the parent layout handles the empty state visually.

**`src/routes/_authenticated/workspaces/$id/inbox/$conversationId.tsx`**  
Matches `/workspaces/$id/inbox/$conversationId`. Component renders `null`; the parent layout renders `MessageThread` driven by the URL param.

## State Mapping

| Before | After |
|--------|-------|
| `selectedId` useState | `conversationId` from `useParams({ strict: false })` |
| `setSelectedId(id)` | `navigate({ to: './$conversationId', params: { conversationId: id } })` |
| `setMobilePane('list')` in back handler | `navigate({ to: '.' })` |
| `mobilePane` useState | Derived from `conversationId` + `isContactPanelOpen` |

## Behaviours Preserved

- Empty thread state on `/inbox` (no conversation selected).
- Mobile pane switching (list / thread / contact) works as before, now derived from URL.
- Contact panel open/close state stays in layout useState — unchanged.
- Browser back/forward navigates between conversations naturally.
- Filters (`primaryFilter`, `searchQuery`) remain local state in the layout — not in the URL.

## Out of Scope

- Persisting filter state in the URL.
- Auto-selecting the first conversation on load.
- Any changes to `MessageThread`, `ConversationList`, or other inbox sub-components.
