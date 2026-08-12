---
target: settings/members page
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
timestamp: 2026-08-12T18-52-12Z
slug: s-authenticated-workspaces-id-settings-members-tsx
---
Method: dual-agent (A: design review, source-only · B: detector + live browser), run isolated and in parallel; neither saw the other's output before synthesis.

Two disclosures up front, because they bound what this report can claim:

1. **Assessment A ran source-only.** The in-app browser is a single shared pane; two agents driving it in parallel would have corrupted both. B owned it exclusively. A's layout claims are therefore reasoned from CSS and string length — and B independently measured them, which is why the truncation finding below is stated as measurement rather than inference.
2. **No screenshots exist.** B's screenshot tool failed on every attempt (`the Browser pane is not displayed, so the page is not compositing frames`). B fell back to accessibility trees plus `getBoundingClientRect` / `getComputedStyle` / computed contrast — harder numbers than a picture for truncation and contrast, but blind to optical spacing, alignment, and rhythm. Nobody in this loop has seen this page.

Target: `src/features/workspaces/components/workspace-members-section.tsx` (route `src/routes/_authenticated/workspaces/$id/settings/members.tsx`). Mode: **Operate**. Live URL inspected: `/workspaces/6cdd0dfa…/settings/members`, Russian, both color modes.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Three of four mutations produce no success feedback. Role change binds `value` to server state (`:393`) and disables during pending (`:399`) with no optimistic update — the control displays the *old* role, greyed, until refetch. Skeletons carry no `aria-busy`. |
| 2 | Match System / Real World | 2 | Three bare role nouns, meaning stated nowhere in the product. Untranslated English in a Russian UI (B, live): "Skip to content", "to navigate", `Side navigation`, `Close`, `Collapse sidebar`, `Notifications`, 15 icon names. |
| 3 | User Control and Freedom | 2 | Esc dismisses every overlay and restores focus to the trigger (B, verified). But removal is unconfirmed and un-undoable, and a plain member has **no way to leave** — `canManage` (`:369`) hides the only menu. |
| 4 | Consistency and Standards | 2 | The sibling channels page gives its load error a retry (`channel-list.tsx:106-117`); this one gives a dead sentence (`:82`). The repo's destructive precedent is `AlertDialog` (`deactivate-channel-dialog.tsx:39-51`) — skipped. Settings sub-nav is a `<nav>` landmark driving roving-tabindex `<button>`s with no `role="tab"` (B). |
| 5 | Error Prevention | 2 | The last-owner guard is exemplary. Self-demotion with ≥2 owners is unguarded; self-removal is unguarded and mislabelled; destructive removal has no confirm step. |
| 6 | Recognition Rather Than Recall | 1 | Measured live: `"Действия: Arnur Kupanov"` ×4, `"Arnur Kupanov"` ×5 — accessible names are built from display name and do not disambiguate. `workspaceMemberLabels` exists for exactly this and is used by `contacts-page.tsx:149`, not here. `joinedAt` fetched and discarded. |
| 7 | Flexibility and Efficiency | 1 | No search, filter, sort, bulk action, or multi-address invite. Every role change is a two-click popover; every removal two clicks through a kebab holding one item. |
| 8 | Aesthetic and Minimalist Design | 2 | Measured: the member's name renders at **12px/500** — same size as the muted headings around it and *smaller* than the field labels "Email адрес"/"Роль" at 14px. Hierarchy is inverted. The pending block is permanently on screen announcing it is empty (`:239`). |
| 9 | Error Recovery | 3 | Strongest part. `membershipErrorMessage` maps nine RPC tokens to nine specific localized sentences and never leaks Postgres text (`workspace-membership.ts:50-89`); invite error carries `role="alert"`. Gap: both load errors (`:82`, `:236`) have no `role="alert"` and no retry. |
| 10 | Help and Documentation | 2 | The invite constraint is real, permanent, in-context help. The permissions model — the thing an admin needs explained — gets nothing, and there is nowhere to look it up. |
| **Total** | | **19/40** | **Poor / Acceptable boundary** |

All ten heuristics apply on an Operate surface. 19 sits one point under the Acceptable band. That is a page whose *engineering* is careful and whose *design decisions* were never made.

## Design Specificity Verdict

**LLM assessment (unanchored):** Generic SaaS team-settings. Swap three strings and it ships in a project tracker, a billing dashboard, or a CMS unchanged. Nothing in the composition or interaction model knows Rezzy is a shared inbox. This roster is the assignment pool for the entire product, yet a row is a face, a name, and a role dropdown — no channel access, no conversation load, no indication of who is actually working the inbox. The repository already owns a richer person object: `WorkspaceMemberCard` (`entities/workspace/ui/workspace-member-card.tsx`) renders name, job title, role and phone, and the *conversation list* shows it on hover. **The one page dedicated to people shows strictly less about a person than an incidental hover in the inbox does.** The care here is real and it all went into correctness — last-owner guards, error-token localization, admin-flash prevention — not into authoring a members surface for this product.

**Deterministic scan:** `detect.mjs` returned **exit 0, zero findings** on all three targets (`features/workspaces/components`; `routes/_authenticated/workspaces`, 13 files; `settings-shell.tsx` + `settings-section.tsx` + `entities/workspace/ui`, 5 files).

**Read that as "no rule matches", not "clean."** B did not take the zeroes at face value: it wrote a deliberately awful probe `.tsx` (inline `#ff0000`, `fontSize: 11px`, `<img>` with no alt, `class=` instead of `className`, unlabeled `<input>`, `z-index: 99999`) and got **exit 0, `[]`** — with and without `--no-config`, from a neutral cwd. The same defects in a `.html` file fired one `dark-glow` rule. The detector runs and can emit; its rule set is oriented at rendered visual-slop signals evaluated against a real cascade, and contributed nothing on TSX input. **Every substantive finding below came from browser measurement or source review.** No false positives to assess.

**Visual overlays:** none. B confirmed injection *was* available (`canSetTitle: true, canInjectScript: true`) and deliberately skipped it: the pane does not composite, so an overlay would render where nobody can see it. `live-server.mjs` was never started, so there is nothing to stop. Fallback signal used: accessibility-tree reads plus computed-geometry measurement.

## Overall Impression

This page is unusually well-engineered and barely designed. The code comments are some of the best I have read in a repo — the last-owner guard, the `isAdminLoaded` flash gate, the Avatar-initials fix for "Без имени", the `disabledMessage` reasoning — each documents a real decision and a real trade-off. Then the same file ships a one-click irreversible removal of a colleague from every live customer thread, with no dialog, no undo, no success message, and in the same neutral text color as every other label on the page.

The single biggest opportunity is not a fix, it is a reframe: **decide what a member row is for.** Right now it is a permissions control that happens to have a name attached. In an inbox-first product it should be a person you can see the work of. Everything else on this list follows from that.

## What's Working

1. **The last-owner guard is exemplary reasoning made visible.** `ownerCount`/`isLastOwner` (`:60-62`) derive from the roster query already in hand — zero extra requests — and mirror what the RPC enforces. It disables *both* affected controls, and where `DropdownMenuItemData` has no message slot, the menu item's own label becomes the reason (`:414-415`) rather than shipping a mute greyed row. B verified the payoff live: the `aria-disabled` selector **remains focusable**, so the hint is genuinely reachable by AT.
2. **Error copy is specific, localized, and safe.** Nine RPC tokens map to nine distinct human sentences (`workspace-membership.ts:50-68`), with an explicit decision that unknown tokens fall back rather than leak Postgres text. "Этого человека больше нет в пространстве" tells a user exactly what happened.
3. **The accessibility plumbing under the components is genuinely correct** — and A, working from source, under-credited it. B measured: focus-visible renders a real 2px outline at **7.38:1 dark / 7.77:1 light**; Esc dismisses every overlay and returns focus to the trigger; the role `Selector` exposes `aria-expanded`, `aria-controls`, `aria-activedescendant`, `aria-haspopup="listbox"` and per-option `aria-selected`, keeping focus on the combobox. Text contrast passes everywhere measured (secondary 5.38:1, primary 15.25:1). The failures below are composition failures, not plumbing failures.

## Priority Issues

### [P0] Removing a colleague is one unconfirmed click, and looks like nothing
**What:** `handleRemove` (`:339-348`) wired straight into the `MoreMenu` item (`:414-420`). B opened the menu and read it without activating: one `role="menuitem"`, "Удалить из пространства", computed color `rgb(37,37,42)` — the same neutral primary as every other label. No danger variant, no dialog, no undo, and `handleRemove` has only an error path so there is no confirmation afterwards either.

**Why it matters:** An account manager scanning rows at 12px, on a row whose kebab sits 12px from the role dropdown, is two accidental clicks from cutting a colleague out of every live customer thread in the workspace — mid-quarter, mid-deal. The product treats this as lighter than disconnecting a Telegram channel, which gets a full `AlertDialog`. Astryx's `AlertDialog` docs name "revoking access" as the use case and ship a confirmation template whose stated example is "removing team members".

**Fix:** Wrap removal in `AlertDialog` with `actionVariant="destructive"`, naming the person and the consequence ("Анна потеряет доступ к диалогам этого пространства"). Add an `onSuccess` toast. Reuse `DeactivateChannelDialog`'s shape verbatim — the pattern already ships twice in this repo for smaller stakes.

**Suggested command:** `$impeccable harden`

### [P0] The member's name truncates at 320px, in the base locale, and the role dropdown is what eats it
**What:** `:351`, `flex items-center gap-3`, no wrap. Measured by B at 320px:

| Name | px needed | px available | truncated |
|---|---|---|---|
| Arnur Kupanov | 86 | 74 | yes |
| Александр Верещагин | 135 | 74 | yes |
| Екатерина Мирошниченко | 157 | 74 | yes |
| Владимир Константинопольский | 196 | 74 | yes |

The mechanism, measured: the name column is `flex-1 min-w-0` and absorbs every pixel of loss, while the role `Selector` is intrinsically sized and **grows with its own content** — switching its value to "Администратор" widened the combobox 76px → 124px. So the longest role label steals width from the name, not the reverse. The name column keeps ~74px: six to eight Cyrillic characters.

**Why it matters:** `baseLocale` is `ru`. This is the default experience, not an edge case. Even the short Latin test name ellipsizes. The name is the only thing identifying the row, and the control eating it is the row's least-used affordance — on the page where you choose which person to remove. AGENTS.md is explicit that jsdom cannot see this and nothing in the suite will ever catch it. (375px is clean; 1280px is clean; document overflow is zero at every width.)

**Fix:** Cap the row's role control (`w-28`/`max-w-28` with its own truncation), or drop it below the name at `<sm` the way the invite form already stacks. Better: move role out of the row entirely — see the grouping question below.

**Suggested command:** `$impeccable adapt`

### [P1] A member cannot leave, and leaving is mislabelled as removal
**What:** the `canManage` gate at `:369`. `workspace_settings_members_leave` — "Покинуть пространство" — exists in `messages/ru.json:132` and `messages/en.json`, and in the original plan doc, and is referenced **nowhere in `src/`**. I verified this independently of both agents.

**Why it matters:** An account manager who moves off a client account is stuck in that workspace forever and has to ask an owner. Meanwhile an admin *can* remove themselves, under a label that reads as an action taken on someone else — and the app leaves them sitting on the settings page for a workspace RLS has just withdrawn. The backend and cache layer already implement this correctly and document it: `use-workspace-membership.ts:126-141` states "remove_workspace_member doubles as leave" and invalidates the workspace list for exactly this case. Only the UI is missing.

**Fix:** Render the `MoreMenu` on a user's **own** row regardless of `canManage`, with the label switched to `m.workspace_settings_members_leave()` when `member.userId === user.id`, its own confirmation copy, and a `navigate` away on success.

**Suggested command:** `$impeccable harden`

### [P1] Role names carry no meaning, and the component already offers the fix
**What:** both `Selector`s, `:189-192` and `:395-398`.

**Why it matters:** "Владелец / Администратор / Участник" is a permissions decision with no information attached. A sales lead adding a new AE has to guess whether Администратор can disconnect the team's WhatsApp number. Guessing permissively is a security incident; guessing restrictively is a support ticket. No tooltip, no docs link, no help page anywhere in the product. This is the single largest driver of the Help score.

**Fix:** `Selector` ships `renderOption` and `description`. Put one line under each role — "Приглашает участников и подключает каналы" / "Работает с диалогами" — and add keys to both catalogues. Two lines of code plus copy. Separately: the invite role `Selector` has exactly **two** options (`invite-member-schema.ts:12`), which Astryx's own guidance says should be a `SegmentedControl` or radios; two radio labels with descriptions solves the invite path's role semantics for free.

**Suggested command:** `$impeccable clarify`

### [P1] The most frequent action on the page looks like it failed
**What:** `handleRoleChange` (`:328-337`) with `value={member.role}` (`:393`) and `isDisabled={… || updateRole.isPending}` (`:399`).

**Why it matters:** Pick "Администратор" on a row. The dropdown closes, the control greys — and it still says "Участник", because `value` is bound to server state with no optimistic update. For the length of a refetch the interface actively tells the admin their change did not take. Then it silently flips, and no toast ever confirms it. A disabled control displaying the pre-change value reads as rejection, which produces the double-click this code does at least block. Compounding it, `disabledMessage` is `undefined` in the pending case, so it is a greyed control with no explanation.

**Fix:** Optimistic update in `useUpdateMemberRole` with rollback in `onError` — the cache key is already centralized in `invalidateRoster` — plus an `onSuccess` toast naming the person and the new role. Same for revoke, which also succeeds silently (`:219-225`).

**Suggested command:** `$impeccable harden`

## Cognitive Load

**5 of 8 failed → high / critical band.**

| # | Item | Result |
|---|------|--------|
| 1 | Single focus | **FAIL** — the page's first and largest object is a creation form for the rarer task; the roster named in the tab is third. |
| 2 | Chunking (≤4/group) | **FAIL** — unbounded flat roster. The RPC **already** orders owner → admin → member (`20260731170100_contacts_directory_rpcs.sql:288-296`) and the UI discards that structure: no group headers, no role column. |
| 3 | Visual grouping | PASS (weak) — the invite form (`:146`) uses the identical `border-y` treatment as the two row groups, so a form and a list read as the same kind of object. |
| 4 | Visual hierarchy | **FAIL** — measured: section heading (`:75`) and member name (`:358`) are both 12px/500, separated only by tone, and both are *smaller* than the invite field labels at 14px. |
| 5 | One thing at a time | PASS |
| 6 | Minimal choices (≤4) | PASS — role Selector 3, invite role 2, MoreMenu 1. **No decision point exceeds 4 visible options.** |
| 7 | Working memory | **FAIL** — the user must supply the entire permissions model from outside the product, and must remember their own name to find their own row before a destructive click. |
| 8 | Progressive disclosure | **FAIL** — invite form permanently expanded with a 149-character Russian help paragraph; the pending section renders a heading plus "Нет приглашений, ожидающих ответа" on every visit to every workspace that has none. |

## Emotional Journey

- **Valley 1 — the change that appears to fail.** The role selector showing the old value, greyed, after you picked a new one. Most common action, worst feedback on the page.
- **Valley 2 — removal with no ceremony and no receipt.** Two clicks, no dialog, no confirmation afterwards. The row eventually vanishes.
- **Valley 3 — the trapdoor under your own feet.** Your own row's menu says "Удалить из пространства", identical to everyone else's. The hook knows and handles this case; the UI never navigates away, so you are left on the settings page of a workspace you just left.
- **Valley 4 — the member who cannot leave.** A non-admin sees a `Badge` and nothing else (`:425`). There is no exit. The string for it was written and never wired up.
- **No peak anywhere.** The one moment that could carry warmth — a successful invite — is a four-word toast and a form reset. Nothing says what happens next, when it expires, or that the person now appears two sections down.

## Persona Red Flags

**Sam (screen reader / keyboard-only)** — the plumbing passes and the composition fails.
- **Duplicate accessible names, measured live.** `combobox "Роль: Arnur Kupanov"` and `button "Действия: Arnur Kupanov"` on both rows: `"Действия: Arnur Kupanov"` ×4 on the page. Labels are built from display name and only disambiguate when names are unique. `workspaceMemberLabels` (`entities/workspace/lib/member-labels.ts`) exists for this, its docstring warns two Иванов Ивановых in one workspace is ordinary, and `contacts-page.tsx:149` uses it. The page where you choose which duplicate to *remove* is the one place that does not.
- **No list semantics.** The roster is a bare `<div class="divide-y">` of `<div>`s, `role: none` throughout. No item count, no list boundary. Same for pending invitations.
- **Load failure is silent.** `:82` and `:236` render error text in a plain `div` — no `role="alert"`, no `aria-live` — while the invite error 120 lines away *does* have `role="alert"` (`:205`). Skeletons have no `aria-busy`.
- **Settings sub-nav semantics mismatch.** `<nav aria-label="Разделы настроек">` containing three plain `<button>`s with roving tabindex and `aria-current="page"`, but no `role="tablist"`/`tab`/`aria-selected`. "Общие" and "Каналы" are unreachable by Tab and nothing announces that arrows apply. They are buttons rather than links despite changing the URL — no middle-click, no open-in-new-tab.
- **Unverified, flagged not asserted:** focus after a successful remove. Source says the focused `MoreMenu` trigger unmounts with its row (`:91-99`) and nothing catches focus. B could not test it without actually removing a member. Needs a human with a real keyboard.

**Casey (distracted, one-handed, 320px, Russian)**
- The truncation table above — six to eight characters of name.
- **The last-owner explanation is a 51-character sentence used as a menu-item label** (`:415`). DESIGN.md Known drift 10 warns fixed-width controls were sized against English. If that truncates on a phone, the mechanism this row was deliberately redesigned around delivers nothing, and nothing in the suite can see it.
- **Nothing on this page meets a touch target.** Astryx buttons are a fixed 32px (DESIGN.md Known drift 7) and `size="sm"` is smaller. `settings-shell.tsx:222` applies `pointer-coarse:[&_button]:min-h-11` **only to the tab strip**; the members content gets no floor. Two adjacent sub-44px controls, 12px apart, are "change permissions" and "delete person".
- **The fold is spent on the wrong thing.** Header + invite title + invite description + a 149-character help paragraph + email + role + button + "Ожидают ответа" + "Нет приглашений…" — all before the first colleague. On a phone the members page opens on everything except the members.

**Riley (stress tester)**
- **Self-demotion with two owners is unguarded.** `isLastOwner` is false, so an owner can pick "Участник" on their own row in two clicks, no warning, no undo — and `OWNER_ROLE_REQUIRES_OWNER` then means only the *other* owner can restore it.
- **Two admins, one stale roster.** `useWorkspaceMemberDirectory` carries `staleTime: 5 * 60 * 1000` with `refetchOnWindowFocus: false` (`use-workspaces.ts:51`). Admin B keeps live controls on a member Admin A deleted five minutes ago, clicks remove, gets the well-written `MEMBER_NOT_FOUND` toast — and the ghost row stays, because the error path (`:344`) invalidates nothing.
- **Re-invite as resend is implemented and unreachable.** The RPC upserts on pending `(workspace_id, invited_user_id)`, so resending works at the API. But the pending row prints `invitedName || invitedEmail` (`:273`), so once a name resolves the address is hidden — to resend you must retype an email the page refuses to show you. A working feature disabled by one `||`.

## Minor Observations

- **Color mode does not react live.** Changing the OS scheme without reloading leaves a split state: `data-theme` and `body` stay dark while Astryx surfaces flip to white — dark chrome framing light content. A reload resolves it.
- **`border-border/60` / `divide-border/60` appears 12 times in this one file** (8 lines). Repo-wide the count is now **40**; DESIGN.md Known drift 9 records 30. This page holds ~30% of the project's documented hairline drift and is where a cleanup should start.
- **The empty state is unreachable.** `:85-88` renders "Пока никого нет" — but you read this page from inside the workspace, so the roster always contains at least you. If it did render, `canManage` would be false and the invite form hidden: a dead end. Dead code carrying dead copy.
- **`joinedAt` is fetched, typed, and thrown away.** The RPC returns it, `WorkspaceMember` carries it (`model/member.ts:21`), no row shows it. "В команде с марта" is the cheapest real content available for a row that currently holds one fact.
- **Pending invitations show no date and no expiry.** `createdAt` is on `WorkspaceInvitationForAdmin` and unused. An admin cannot tell a two-hour-old invite from a three-week-old one — exactly the judgement "should I nudge them" needs.
- **Every `Badge` is `variant="neutral"`** (`:284`, `:425`). Correctly avoids color-alone state, but it also means owner/admin/member are visually identical chips, so the non-admin view carries no scannable role structure despite arriving pre-sorted by role.
- **Two off-route dialogs are permanently mounted** ("Приглашение в пространство", "Новое пространство" with all 15 icon buttons), contributing two `<h2>`s *before* the page's `<h1>`. Within `main` the heading order is correct.
- **Invite submit omits `variant="primary"`** (`:197`) where the general-settings save sets it (`settings/index.tsx:200`).
- **The one console warning is not route-specific:** Astryx reporting that theme `stone` uses runtime style injection and recommending the pre-built theme. Network: 250 requests, all 200, zero failures, zero duplicates.
- **The channels sibling drifted, not this page.** `channel-list.tsx:26` hand-rolls a `text-lg font-semibold` header while this page correctly uses `SettingsSectionHeader` — send that fix to the other file.

## Questions to Consider

1. If the roster is the assignment pool for the whole inbox, why is "who is actually working conversations right now" absent from the one page that lists people — and what would this page look like if that were the primary column instead of a role dropdown?
2. The database already sorts owner → admin → member. What justifies flattening a hierarchy the data hands you for free, instead of three labelled groups — which would also delete most of the per-row dropdowns and hand the name back its width at 320px?
3. Removal is the highest-stakes action here and it hides in a kebab holding one item, while the *reversible* role change gets a permanent always-visible control. Should that priority be inverted?
4. Why is the invite a permanent inline form at all? Every other creation flow in this product opens a modal (`ConnectChannelModal`, `CreateWorkspaceModal`, `ContactFormDialog`). A button in the section header would return the page to its subject, recover the mobile fold, and give the invite room to explain roles properly.
5. If a role's meaning cannot be stated in one line under its name, is the permissions model itself too vague to ship?
6. What does this page do at 200 members? No search, no pagination, no virtualization, no filter. At what headcount does that stop being a design question and become a support ticket?
