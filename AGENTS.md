# Repository Instructions

## Source of Truth

Treat the repository itself as the source of truth.

Before changing code, inspect the relevant files, nearby patterns, `package.json`, and current generated types. If an instruction conflicts with the implementation, do not force the code to match stale documentation; preserve the working architecture and update documentation when appropriate.

`AGENTS.md` is the canonical shared instruction file for coding agents in this repository.

## Product

The repository contains **Rezzy**, a production-oriented, multi-workspace CRM and shared customer inbox for sales and account-management teams.

Build real workflows, not tutorial CRUD screens. Prioritize:

- clear information hierarchy
- fast inbox and contact workflows
- realistic business states and failure handling
- responsive and accessible interactions
- polished loading, empty, error, optimistic, and disabled states
- maintainable architecture over shortcuts

Avoid placeholder content, generic admin-dashboard patterns, decorative complexity, and speculative abstractions.

For product decisions, consult `PRODUCT.md`. For visual-system work, consult `DESIGN.md` and the existing implementation.

## Stack and Tooling

Use the versions and scripts declared in `package.json` as the authoritative source.

Core stack:

- React and TypeScript
- Vite
- TanStack Router and TanStack Query
- HeroUI React v3 and Tailwind CSS v4
- React Hook Form and Zod
- Supabase
- Paraglide/Inlang
- Vitest and Testing Library

Use **pnpm** only. Do not introduce a new dependency unless the user explicitly approves it.

The `@/*` import alias maps to `src/*`.

## Architecture

The project follows a pragmatic Feature-Sliced Design structure.

### Dependency direction

Prefer this import direction:

`routes -> widgets -> features -> entities -> shared infrastructure`

A lower layer must not import a higher layer:

- `entities` must not import from `features`, `widgets`, or `routes`
- `features` must not import from `widgets` or `routes`
- `widgets` must not import from `routes`
- shared infrastructure must not depend on product features

Do not reorganize files merely to make the structure look more theoretical. Preserve established boundaries unless the task requires an architectural change.

### Folder responsibilities

#### `src/routes`

TanStack Router file-based routes.

- Keep route files thin.
- Parse route params and search state here.
- Compose page-level UI from widgets or features.
- Move business logic, server-state logic, and substantial UI into the appropriate layer.

#### `src/widgets`

Large application-shell or page-composition units, such as the app header and sidebar.

Widgets may compose features and entities, but should not own reusable domain logic.

#### `src/features`

User-facing capabilities and business workflows.

A feature may contain its API functions, query hooks, schemas, components, and feature-specific utilities. Keep logic close to the feature that owns it.

#### `src/entities`

Reusable domain models and domain UI for concepts such as channels, contacts, conversations, messages, users, and workspaces.

Entities may depend on shared infrastructure, but never on features.

Prefer explicit named exports from entity `index.ts` files.

#### Shared infrastructure

The following folders are shared or application infrastructure:

- `src/components`: generic reusable UI components without feature-specific business logic
- `src/hooks`: reusable application hooks
- `src/lib`: shared application helpers
- `src/utils`: shared utilities and infrastructure, including the Supabase client
- `src/providers`: application-wide providers
- `src/api`: generated Supabase database types and truly global API types/setup

Do not move feature-specific code into shared folders merely because it is reused once.

## React and TypeScript

- Keep TypeScript strict.
- Do not use `any` unless an external boundary makes it unavoidable and the reason is documented.
- Prefer narrow types, discriminated unions, and explicit public API types.
- Handle `null` and `undefined` deliberately.
- Infer form and payload types from Zod schemas when practical.
- Avoid unsafe casts and non-null assertions.
- Prefer small, composable components with clear ownership.
- Do not create abstractions before meaningful duplication exists.

Preserve existing behavior and styling unless the task explicitly requests a redesign or behavior change.

## Data Fetching

Use TanStack Query for server state.

- Put feature query logic in the owning feature.
- Reuse query-key factories, query options, and existing hooks.
- Avoid inline Supabase queries inside presentation components.
- Handle loading, empty, error, refetching, and optimistic states explicitly.
- Keep realtime cache updates consistent with existing inbox patterns.

## Forms

Use React Hook Form with Zod validation.

- Define validation in schemas.
- Prefer `z.infer<typeof schema>` for form values.
- Keep submission and mutation behavior in the owning feature.
- Reuse form fields when reuse improves consistency rather than hiding simple code.

## UI and HeroUI

Use HeroUI components when they fit the interaction, and Tailwind CSS for layout, spacing, responsive behavior, and focused visual adjustments.

HeroUI v3 differs from earlier HeroUI/NextUI APIs. For component work:

1. Inspect current usage in this repository.
2. Check the installed package types.
3. Consult the official HeroUI v3 documentation or `https://heroui.com/llms-patterns.txt` when external documentation is available.

Do not rely on remembered v2 APIs. Do not run a documentation generator that overwrites this file, and do not paste a generated component index into `AGENTS.md`.

Follow the design tokens and visual rules already implemented in `src/styles.css` and described in `DESIGN.md`. Avoid one-off colors, spacing scales, and component variants without a clear need.

## Internationalization

All user-facing text must use Paraglide/Inlang.

- Edit source messages in `messages/en.json` and `messages/ru.json`.
- Keep keys readable and grouped by feature.
- Do not manually edit generated files under `src/paraglide`.
- Run the existing compile/typecheck scripts after message changes.

## Supabase

- Treat files in `supabase/migrations` as the database history and source of truth.
- Keep browser-side access constrained by RLS.
- Keep service-role access and secrets inside trusted Supabase Edge Functions.
- Never expose channel credentials to the client.
- Access `private.channel_secrets` only through the existing RPC helpers; do not query the private table directly from application code.
- Do not manually edit `src/api/types.ts`.
- Regenerate local types with `pnpm types:supabase:local` or linked-project types with `pnpm types:supabase:linked`, depending on the task.
- Preserve workspace scoping in queries, mutations, policies, RPCs, and realtime subscriptions.

For database changes, add a migration and update relevant database tests. Do not rewrite old migrations that may already be applied.

## Generated Files

Do not manually edit:

- `src/routeTree.gen.ts`
- `src/paraglide/**`
- `src/api/types.ts`

Change their source inputs and regenerate them with the repository scripts.

## Test Account

For manual and browser-driven verification against the development Supabase project, use the shared test account:

- Email: `ncase01@gmail.com`
- Password: `123456789`

This is a disposable test login for the dev environment only. Never reuse these credentials for production data or real customer workspaces.

## Testing and Validation

Add or update tests for critical business logic, regressions, complex hooks, reusable utilities, and important user interactions. Prefer meaningful tests over coverage-only tests.

For code changes, run the smallest relevant validation set, with `pnpm typecheck` as the minimum expected check.

Useful commands:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm verify
pnpm test:db
```

Use `pnpm verify` for broad or release-sensitive changes when practical. For documentation-only changes, review the diff and verify referenced paths and commands; a full application build is not required.

If a command cannot run because required services, credentials, or local tooling are unavailable, report that clearly instead of claiming success.

## Change Discipline

- Keep diffs focused on the requested task.
- Do not reformat or rename unrelated files.
- Reuse nearby patterns before introducing a new pattern.
- Do not silently change public behavior.
- Do not add dependencies, change architecture, or modify database contracts without a concrete reason.
- Never discard user changes.

For medium or large tasks:

1. Inspect the relevant architecture and nearby examples.
2. State a concise implementation plan.
3. Implement incrementally.
4. Run relevant validation.
5. Summarize changed files, decisions, and any remaining risks.
