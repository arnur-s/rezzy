---
target: profile page
total_score: 20
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 4
timestamp: 2026-07-26T14-48-41Z
slug: src-features-account-components-profile-page-tsx
---

⚠️ DEGRADED: single-context (session config forbids spawning sub-agents unless explicitly requested)

Evidence base: real browser at localhost:3000, signed in as the test account, /settings/profile at 1440x900 and 390x844, light + dark, in Russian (switched via Settings > Appearance). Computed styles and contrast measured in-page. detect.mjs returned [] (clean).

## Design Health Score

| #         | Heuristic                       | Score     | Key Issue                                                                                                  |
| --------- | ------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| 1         | Visibility of System Status     | 3         | Skeletons, pending labels, recovery banners good. Save confirmation sits 800px below the edited field.     |
| 2         | Match System / Real World       | 1         | "Required"/"Optional" in English on a Russian page. "Участник с May 2026". "Asia/Almaty" as resting value. |
| 3         | User Control and Freedom        | 2         | No discard/revert. Avatar upload commits instantly, no undo to old picture.                                |
| 4         | Consistency and Standards       | 2         | Two save models on one screen. Labels render 16px against documented 13/10px system.                       |
| 5         | Error Prevention                | 1         | Phone: no mask, no type="tel", no inputMode, no normalization. Zero autocomplete on any field.             |
| 6         | Recognition Rather Than Recall  | 2         | Timezone dropdown shows +05:00 then discards it on select.                                                 |
| 7         | Flexibility and Efficiency      | 2         | Browser autofill structurally disabled. No Cmd-S. Save a scroll away.                                      |
| 8         | Aesthetic and Minimalist Design | 2         | Three stacked title blocks before content; description under all six fields; uniform visual weight.        |
| 9         | Error Recovery                  | 3         | Strongest thing on the page. Failed load keeps form usable and says so.                                    |
| 10        | Help and Documentation          | 2         | Email tooltip names a prohibition and no destination — because none exists.                                |
| **Total** |                                 | **20/40** | **Acceptable (bottom edge)**                                                                               |

## Design Specificity Verdict

Category-interchangeable. Cover the sidebar and this is any B2B SaaS settings page: avatar top-left, stacked full-width fields, helper text under every label, one Save at the bottom. PRODUCT.md's anti-reference "Generic SaaS admin dashboard... interchangeable design language" describes this page.

DESIGN.md commits to a specific settings grammar — ruled row groups, hairline division, SettingRow with label/description left and control right. This page uses none of it.

Deterministic scan: detect.mjs on src/features/account + settings.tsx -> 0 findings. No hardcoded hex, no arbitrary values, no raw div layout abuse. Every issue below lives above the mechanically-checkable line.

## Overall Impression

Nothing on this page has a size. Measured:

- h1 "Аккаунт": 16px/600
- h2 "Ваши данные": 16px/600
- Field label "Полное имя": 16px/500
- Input value "Arnur": 16px/400
- Button "Сохранить изменения": 16px/500
- Field description: 13px/400
- "Личные настройки" kicker: 10px/500

Page title, section heading, every field label, every typed value, and the primary button are all the same size. The only differentiated text is helper text — smaller — so the least important text is the only text with distinct treatment, and the kicker is the smallest thing on screen.

Root cause, src/themes/gothic/theme.css:122:
--text-label-size: var(--font-size-base); /_ 16px _/
--text-body-size: var(--font-size-base); /_ 16px _/
--font-size-sm: 0.8125rem; /_ 13px, unused by Astryx _/
--font-size-xs: 0.625rem; /_ 10px, unused by Astryx _/

Every Astryx form component resolves label and body to 16px. Hand-authored Tailwind resolves text-sm to 13px. Two type systems, one step apart, on one page. DESIGN.md's Two-Size Rule describes only the Tailwind half and is stale about the Astryx half (documentation drift, reported not repaired).

## What's Working

- Failure copy is the best writing in the product. "Ваши данные на месте. Проверьте соединение и попробуйте ещё раз." states the user's fear and answers it before instructing.
- Load-failure architecture: profile-page.tsx:29 falls back to auth metadata so a dead query still yields an editable form.
- Save-state discipline: disabled until dirty, tooltip explaining why, isPending guard against queued Enter, re-baseline on success.

## Priority Issues

### [P1] The type scale is inverted — a theme fix, not a page fix

Why it matters: every scanning problem descends from this. No entry point means linear reading on a page visited fifty times.
Fix: rebind in gothicTheme.ts then pnpm theme:build — --text-label-size -> --font-size-sm (13px), --text-supporting-size -> --font-size-xs (10px). Leave --text-body-size at 16px (input value; Safari iOS force-zooms under 16px). Then delete the "Личные настройки" kicker.
Blast radius: every Astryx form in the app.
Suggested command: /impeccable typeset

### [P1] Two strings are hardcoded English on a fully Russian page

1. "Required"/"Optional" — FieldLabel.js:52 in the vendored library, no locale hook, no override prop. Cannot be fixed by passing props.
2. "Участник с May 2026" — workspace-membership-list.tsx:28 passes undefined as locale = browser locale, not app locale. Same bug in relative-time.ts:7,12,65 and channel-card.tsx:38, so inbox timestamps are wrong the same way.
   Fix: swizzle Field and localize statusText (isRequired sets aria-required, so swizzle rather than drop). Pass getLocale() to Intl.DateTimeFormat at four sites.
   Suggested command: /impeccable harden

### [P1] The email tooltip points at a place that doesn't exist

"Почту для входа нельзя изменить здесь" implies an elsewhere. No email-change flow exists anywhere in the product. Security shows the same address, also read-only. Field is dead weight twice.
Also: disabled label at rgb(150,160,171) = 2.32:1 against page, while its value sits at 16.30:1. Label unreadable, value shouts.
Fix: either say the truth ("Адрес входа изменить нельзя — напишите нам, если он устарел.") or delete the field from Profile. Recommend deleting; Security owns "how you get in."
Suggested command: /impeccable clarify

### [P1] The phone field has no phone affordances

All six inputs: type "text", inputMode "", autoComplete "", name "".

- No mask: +77765218213 / 8 (777) 521-82-13 / +7 777 521 8213 all land in one column. Nothing downstream can dial or dedupe.
- No type="tel"/inputMode="tel": mobile users get QWERTY for digits.
- No autocomplete anywhere: browser/OS autofill structurally off across the whole form.
- Regex /^[+(\d][\d\s().-]\*$/ accepts 1.2.3 and +((((1-2-3.
  Fix: type="tel", inputMode="tel", autocomplete="tel"; format on blur, store E.164. Add autocomplete="name"/"email"/"organization-title". A real mask needs libphonenumber-js — new dependency, requires approval.
  Suggested command: /impeccable harden

### [P2] Six fields, six descriptions, none earn the line

Every field is label + description + input = three lines, so the page is a wall of uniform grey and none signals "read me."
Rule: a description earns its line only when it tells the user something the label cannot — who sees this, what changes because of it, what breaks if it's wrong.
Applying it drops six descriptions to three.
Suggested command: /impeccable clarify

## Copy rewrite

CUT: account_settings_kicker ("Личные настройки" — h1 + tabs already say it); profile_email_description ("Адрес, с которым вы входите в систему." — label is the sentence); profile_full_name_description (section header already says "Как коллеги видят вас"); profile_job_title_description ("Помогает коллегам понять, к кому и с чем обращаться." — mangled; placeholder teaches the field).

- profile_identity_description -> RU "Эти данные видят коллеги во всех ваших рабочих пространствах." / EN "Your teammates see this in every workspace you belong to."
- profile_phone_description -> RU "Видят только коллеги. Клиентам номер не показывается." / EN "Teammates only. Customers never see this."
- profile_timezone_description -> RU "Время в диалогах показывается в этом поясе." / EN "Times in your conversations are shown in this zone."
- profile_email_disabled_reason -> RU "Адрес входа изменить нельзя — напишите нам, если он устарел." / EN "Your sign-in address can't be changed — contact us if it's out of date."
- profile_save_no_changes -> RU "Изменений нет" / EN "No changes yet"
- profile_workspaces_description -> RU "Ваши пространства и роль в каждом." / EN "Your workspaces and your role in each."

Russian notes: "то, как Rezzy работает для вас" is a word-order calque. "к кому и с чем обращаться" is not idiomatic (обращаться с чем-то reads as handling, not asking about). "Чтобы коллеги могли..." is a subordinate clause with no main clause.

KEEP: profile*avatar_description, all \*\_error*_ and __load_error_\* strings, profile_workspaces_managed_note.

## Persona Red Flags

Alex (power user): autofill dead across six fields, password manager can't fill his own name or phone. Cmd-S does nothing. Save sits below four fields and a 700px file picker — every edit is type, scroll, click.

Sam (accessibility): disabled email label at 2.32:1, invisible while its value renders at 16.30:1. Screen reader announces "Полное имя ∙ Required" — language switch mid-label, Russian phoneme set. Positive: Astryx keeps the disabled email focusable via aria-disabled and wires aria-describedby, so the tooltip does reach him.

Casey (mobile): at 390x844 the first editable field is ~700px down, behind drawer header, h1, kicker, three-line description, tabs, section heading, section description, avatar, avatar label, avatar description, full-width file button, Remove button. Save is two more viewports down, behind the keyboard. Mobile workspace switcher renders "Выбрать рабочее пространств" — clipped mid-word, no ellipsis.

## Minor Observations

- Two save models: avatar commits on pick, every other field waits for Save. Nothing signals which is which.
- Timezone loses its own answer: renderItem shows +05:00 in the dropdown, resting state shows bare Asia/Almaty. Show the offset, better the current time there.
- Selected timezone renders as a grey chip with an X, visually unlike every other field's value.
- FileInput stretches to the full 704px measure and reads as a text input with an arrow.
- "Удалить фото" is a bold ghost button with no chrome — reads as body text, and it's destructive.
- No discard. Once you've typed, reload is the only way back.
- Mobile TabList clips "Безопасность" with no fade or scroll affordance.
- The 64px pane header holds only "Аккаунт", then ~40px dead space before the kicker.

## Questions to Consider

- The product documented a settings grammar (SettingRow, ruled groups, label-left/control-right) and this page uses a plain stacked form. Deliberate exception, or did this page not get the memo?
- If the sign-in email can never be changed and Security already shows it, what is it doing on Profile?
- What would this page look like if the values were the loudest thing on it and the labels were the quiet part?
