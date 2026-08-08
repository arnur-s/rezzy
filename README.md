# Rezzy

Rezzy is an **inbox-first, AI-powered customer engagement platform** for
customer-facing teams.

The current implementation centers on a multi-workspace shared inbox, lightweight
CRM, and Telegram/WhatsApp channel integrations. The product direction expands
that foundation into public social engagement, social publishing, AI assistance,
and carefully scoped automation. Planned capabilities are not assumed to be
implemented; the repository remains the source of truth for current behavior.

The frontend uses React, TypeScript, Vite, TanStack Router, TanStack Query,
Astryx (`@astryxdesign/core`), Tailwind CSS v4, React Hook Form, Zod, Supabase,
and Paraglide/Inlang. English and Russian catalogs live in `messages/`.

Repository documentation:

- [`PRODUCT.md`](PRODUCT.md) — product definition, direction, and boundaries
- [`PRICING.md`](PRICING.md) — working pricing and AI-metering strategy
- [`DESIGN.md`](DESIGN.md) — visual-system and interaction decisions
- [`AGENTS.md`](AGENTS.md) — canonical repository instructions for coding agents
- [`CLAUDE.md`](CLAUDE.md) — Claude-specific operating notes

## Prerequisites

- Node.js `24.18.0` (the pinned and CI-tested version; see `.node-version`)
- pnpm `11.13.0` (pinned by the `packageManager` field)
- Docker Desktop or another Docker-compatible runtime for local Supabase
- A Supabase account only when working with the linked development project

If pnpm is not already available, enable Corepack, then confirm the pinned
version:

```bash
corepack enable
pnpm --version
```

## First-time setup

Install dependencies and create the local frontend environment file:

```bash
pnpm install
cp .env.example .env
```

On PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

For the default local workflow, start Docker and then Supabase:

```bash
pnpm supabase:start
pnpm exec supabase status
```

Copy the local API URL and the local publishable key (or legacy anon key) from
the status output into `.env`. Never use the service-role key in a `VITE_*`
variable.

Start the frontend:

```bash
pnpm dev
```

`pnpm dev` opens a browser. Automation and agents should use `pnpm dev:agent`,
which starts the same server without opening one.

Use `https://127.0.0.1:3000` for the frontend; that exact origin matches the
local Supabase Auth redirect configuration. If Vite opens another hostname,
navigate to the `127.0.0.1` URL instead. Local Supabase Studio is at
`http://127.0.0.1:54323`. The first frontend visit shows a browser warning for
Vite's self-signed development certificate. Accept it once for local
development.

## Local and linked Supabase workflows

The frontend can target either the local stack or the hosted development
project; `.env` decides which one it uses.

| Workflow                   | Use it for                                                                             | Important boundary                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Local Supabase             | Schema, migrations, Auth/RLS, database tests, and ordinary UI development              | Safe to reset; external Telegram and Meta services cannot call loopback webhooks without a tunnel           |
| Linked development project | Real Telegram/WhatsApp callbacks, provider credentials, and end-to-end channel testing | Shared remote state; pushes, secret updates, and function deployments affect the hosted development project |

Local Supabase is the default for database work because the complete schema can
be recreated from versioned migrations without changing shared hosted data. It
is not a requirement for provider integration work: run the frontend locally
against the linked development project when testing real Telegram or WhatsApp
webhooks.

To link this checkout to the hosted development project:

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref <development-project-ref>
```

Linking does not switch the frontend automatically. Put the hosted project URL
and its browser-safe publishable key in `.env` as
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

Commands ending in `:local` are intentionally local. Commands ending in
`:linked`, `supabase db push --linked`, `supabase secrets set`, and
`pnpm deploy-functions:supabase` target the hosted project. Do not run
`supabase db reset --linked`; it destroys remote data.

## Environment variables and secrets

The root `.env` file configures the browser application. Every `VITE_*` value is
included in browser-delivered JavaScript and must be safe to expose.

| Variable                        | Required                     | Purpose                                                                           |
| ------------------------------- | ---------------------------- | --------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | Yes                          | Local or hosted Supabase API URL                                                  |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes                          | Browser-safe Supabase publishable key; the local legacy anon key is also accepted |
| `VITE_WHATSAPP_APP_ID`          | For WhatsApp Embedded Signup | Public Meta app identifier                                                        |
| `VITE_WHATSAPP_CONFIG_ID`       | For WhatsApp Embedded Signup | Public Embedded Signup configuration identifier                                   |
| `VITE_WHATSAPP_GRAPH_VERSION`   | Optional                     | Meta Graph API version; keep it aligned with the Edge Function value              |

Never put `SUPABASE_SERVICE_ROLE_KEY` or `WHATSAPP_APP_SECRET` in the root
`.env` file.

Custom local Edge Function configuration belongs in
`supabase/functions/.env`, which is ignored by Git:

```dotenv
WHATSAPP_APP_ID=
WHATSAPP_APP_SECRET=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_GRAPH_VERSION=
```

`WHATSAPP_VERIFY_TOKEN` must match the value configured for the Meta webhook.
Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` to Edge Functions; do not copy those values into a
committed file. Telegram bot credentials are entered through the channel
connection workflow, not through this environment file.

After linking, upload the custom values to the hosted development project with:

```bash
pnpm exec supabase secrets set --env-file supabase/functions/.env
pnpm exec supabase secrets list
```

Secret values must come from the team's secret manager or provider dashboards;
do not paste them into Git, issues, logs, or chat.

## HTTPS and provider callbacks

Vite intentionally uses HTTPS because Meta's browser SDK and WhatsApp Embedded
Signup require a secure browser origin. Use the exact HTTPS origin shown by
Vite and register the corresponding development origin in Meta when needed.

Telegram and Meta cannot deliver webhooks to `127.0.0.1`. For normal provider
testing, keep Vite local and point `.env` at the linked Supabase development
project, whose Edge Functions have public URLs. A successful incoming WhatsApp
webhook does not by itself grant outgoing-message access; Meta business,
application, number, template, and permission requirements still apply.

## Database workflow

Database changes are versioned as imperative SQL migrations in
`supabase/migrations/`.

1. Create a correctly named migration with the CLI:

   ```bash
   pnpm exec supabase migration new <descriptive-name>
   ```

2. Edit the generated SQL. Browser-accessible tables need explicit grants and
   RLS policies; grants expose the table to an API role, while RLS controls
   which rows that role can access.
3. Rebuild the local database from the full migration chain:

   ```bash
   pnpm supabase:reset
   ```

4. Run the database contract tests and regenerate local TypeScript types:

   ```bash
   pnpm test:db
   pnpm types:supabase:local
   ```

5. Review and commit both the migration and `src/api/types.ts`. Never edit the
   generated type file manually.

`supabase/seed.sql` is intentionally empty. It exists because
`supabase/config.toml` applies it during a start/reset, but this repository does
not create test personas or sample customer data.

Before applying migrations to the linked development project, review the
target and preview the change:

```bash
pnpm exec supabase projects list
pnpm exec supabase db push --linked --dry-run
pnpm exec supabase db push --linked
pnpm types:supabase:linked
```

Deploying Edge Functions is a separate hosted action:

```bash
pnpm deploy-functions:supabase
```

That command deploys all local functions to the linked project. Function JWT
settings are versioned in `supabase/config.toml` and each function's
`config.toml`.

Useful Supabase commands:

| Command                            | Effect                                                            |
| ---------------------------------- | ----------------------------------------------------------------- |
| `pnpm supabase:start`              | Start the local stack and apply pending migrations/seed           |
| `pnpm supabase:stop`               | Stop the local stack while preserving local data                  |
| `pnpm supabase:reset`              | Destroy and recreate only the local database from migrations/seed |
| `pnpm test:db`                     | Run pgTAP database tests against the local stack                  |
| `pnpm types:supabase:local`        | Regenerate `src/api/types.ts` from the local database             |
| `pnpm types:supabase:linked`       | Regenerate `src/api/types.ts` from the linked hosted database     |
| `pnpm full-schema:supabase:local`  | Write a local schema dump to ignored `full-schema.sql`            |
| `pnpm full-schema:supabase:linked` | Write a linked schema dump to ignored `full-schema.sql`           |

See Supabase's official guides for [local development](https://supabase.com/docs/guides/local-development),
[CLI workflows](https://supabase.com/docs/guides/local-development/cli-workflows),
and [Edge Function secrets](https://supabase.com/docs/guides/functions/secrets).

## Validation

Use the smallest relevant validation set for the change, with `pnpm typecheck`
as the minimum expected check for code changes.

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
pnpm test:db
```

Database changes require a running local Supabase stack and `pnpm test:db`.

`pnpm verify` chains typecheck, lint, test, and build in that order and stops at
the first failure. See `AGENTS.md` for the current validation rules.

## Production build

```bash
pnpm build
pnpm preview
```

The deployable SPA is emitted to `dist/`. A static host must serve
`dist/index.html` as the fallback for client-side routes. Deployment-specific
Supabase URLs, publishable keys, provider origins, and webhook URLs must be
configured for that environment before building or registering integrations.

## Project structure

Rezzy follows a pragmatic Feature-Sliced Design direction:

`routes -> widgets -> features -> entities -> shared infrastructure`

- `src/routes/`: thin TanStack Router file-based routes
- `src/widgets/`: large page/shell composition units
- `src/features/`: user-facing capabilities and business workflows
- `src/entities/`: reusable domain models and domain UI
- `src/components/`: generic reusable UI without feature-specific business logic
- `src/hooks/`, `src/lib/`, `src/utils/`, `src/providers/`: shared application infrastructure
- `src/api/`: generated Supabase database types and truly global API setup/types
- `supabase/migrations/`: versioned database changes
- `supabase/functions/`: trusted Deno Edge Functions for provider connections,
  sending, webhooks, and other server-side integration work
- `supabase/tests/database/`: pgTAP database contract tests

Keep route files thin, keep business logic in the owning feature/domain, use
TanStack Query for server state, React Hook Form with Zod for forms, Astryx
components when they fit the interaction, and route user-facing strings through
Paraglide/Inlang. `AGENTS.md` is authoritative when this summary and the current
repository diverge.
