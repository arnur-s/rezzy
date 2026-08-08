# CLAUDE.md

@AGENTS.md

## Claude-specific notes

- Treat `AGENTS.md` as the canonical repository instruction file.
- Treat the repository itself as the source of truth for implementation state, installed package versions, scripts, generated types, and existing patterns.
- Read `PRODUCT.md` for product intent, `PRICING.md` for pricing and AI-metering decisions, and `DESIGN.md` for visual-system decisions when those concerns are relevant.
- Do not duplicate shared repository rules here. If a shared rule needs to change, update `AGENTS.md` instead.
- Do not implement planned product domains merely because they appear in product documentation. Follow the current repository and the concrete task.

## Work in a git worktree

Before changing any file for a task, call `EnterWorktree` to move this session into
`.claude/worktrees/<name>` on its own branch. Several agents work in this repository at
once, and the main checkout is shared: editing it directly puts your uncommitted work in
someone else's `git status` and theirs in yours.

The session lands ready to run — a `SessionStart` hook seeds the new worktree with the
ignored files a fresh checkout lacks. See "Parallel Agent Work (Git Worktrees)" in
`AGENTS.md` for what that covers, which ports each worktree gets, and how to finish a
branch.

Stay in the main checkout only when the task changes nothing on disk (answering a
question, reading code) or when the user asks you to work in place.

## Astryx workflow

Use the Astryx version installed by the repository. Run CLI commands through pnpm:

```bash
pnpm exec astryx <command>
```

Before writing or changing UI:

1. Run `pnpm exec astryx build "<idea>"` to discover the closest page, block, and component patterns.
2. Run `pnpm exec astryx component <Name>` for the exact API of every Astryx component you intend to use. Do not guess props.
3. Use `pnpm exec astryx template <name> [--skeleton]` when a returned page/block template is useful as reference or scaffolding.
4. Inspect existing usage in the repository and the installed package types before introducing a new pattern.
5. Read the relevant section of `DESIGN.md` before making visual or layout decisions.

The installed CLI and package are authoritative. Do not hardcode the Astryx component count or duplicate version information here.

## Rezzy UI guardrails

- Use Astryx components when they fit the interaction. Use token-backed Tailwind utilities for layout, spacing, responsive behavior, and targeted styling as described in `AGENTS.md` and `DESIGN.md`.
- Preserve the existing authenticated shell. Use the established `AppShell`, `AppPaneGroup`, and `AppPane` patterns rather than hand-rolling page framing unless the task explicitly requires an architectural change.
- Do not Card-wrap dense lists or conversation rows. Cards have specific uses defined in `DESIGN.md`; a shell pane is already the containing surface.
- Prefer component props and variants first, then token-backed utilities such as `bg-surface`, `text-primary`, and the repository's mapped radius/spacing classes.
- Do not assume Tailwind default token values. Rezzy remaps typography, radii, colors, shadows, and other tokens through Astryx; consult `DESIGN.md` for the actual values and known drift.
- Treat `src/themes/neutral/neutralTheme.ts` as the theme source of truth. Never override `--color-*` tokens in `:root`.
- Do not copy Astryx StyleX atomic class hashes into application CSS.
- Avoid new raw colors and arbitrary visual values. Preserve the documented platform-brand-color exception and existing deliberate measurements when the implementation requires them.
- Preserve the cascade-layer ordering in `src/styles.css`; Astryx styling can break silently if that order changes.

## Useful Astryx commands

```bash
pnpm exec astryx build "<idea>"
pnpm exec astryx component <Name>
pnpm exec astryx component --list
pnpm exec astryx template <name> [--skeleton]
pnpm exec astryx template --list
pnpm exec astryx search "<thing>"
pnpm exec astryx docs <topic>
```

Useful documentation topics include `color`, `elevation`, `icons`, `illustrations`, `internationalization`, `layout`, `migration`, `motion`, `principles`, `shape`, `spacing`, `styling`, `theme`, `tokens`, and `typography`.

Use `swizzle` only when a task genuinely requires deep component customization. After an explicit `@astryxdesign/core` upgrade, inspect the repository's pinned/generated Astryx overrides and follow the upgrade guidance in `AGENTS.md` before assuming generated selectors remain valid.
