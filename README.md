# Rezzy

Rezzy is an **inbox-first customer engagement platform** for
customer-facing teams.

The current implementation centers on a multi-workspace shared inbox, lightweight
CRM, and Telegram, WhatsApp, and Instagram channel integrations. Provider
permissions and account setup are still required for real channel operation.
The product direction expands
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
- pnpm `11.13.1` (pinned by the `packageManager` field)
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

Use `http://127.0.0.1:3000` for the frontend; that exact origin matches the
local Supabase Auth redirect configuration. If Vite opens another hostname,
navigate to the `127.0.0.1` URL instead. Local Supabase Studio is at
`http://127.0.0.1:54323`. Worktrees use a different port; use the URL printed by
the development server.

### Isolated development accounts

Create disposable users through local Supabase Auth. Use generated passwords
kept in process memory or ignored `.env.local` files; never put shared-account
credentials in tracked documentation. Local email confirmations and password
reset messages can be inspected in the local mail inbox shown by
`pnpm exec supabase status`.

`pnpm test:e2e` creates and removes its own local users and workspace fixtures.
It reads local API credentials into memory, validates the loopback endpoint,
and blocks browser requests to hosted services. Start local Supabase first.
Provider-handler tests mock Telegram/Meta HTTP calls while exercising the real
handlers; they never send messages to real recipients.

The shared account previously listed in `AGENTS.md` requires owner action:
rotate its password and revoke its sessions. Removing the credentials from the
current file does not remove them from Git history or invalidate them.

## Local and linked Supabase workflows

The frontend can target either the local stack or the hosted development
project; `.env` decides which one it uses.

| Workflow                   | Use it for                                                                             | Important boundary                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Local Supabase             | Schema, migrations, Auth/RLS, database tests, and ordinary UI development              | Safe to reset; external Telegram and Meta services cannot call loopback webhooks without a tunnel           |
| Linked development project | Real Telegram/WhatsApp/Instagram callbacks, provider credentials, and end-to-end channel testing | Shared remote state; pushes, secret updates, and function deployments affect the hosted development project |

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

The default Vite configuration uses HTTP. Meta's browser SDK and WhatsApp
Embedded Signup require HTTPS: use a trusted HTTPS development origin or
enable the existing `@vitejs/plugin-basic-ssl` plugin locally for that workflow.
Register the exact callback origin with Meta and Supabase Auth. Do not assume
that ordinary local sign-in verifies provider OAuth or embedded signup.

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
pnpm test:db:races
```

Database changes require a running local Supabase stack and `pnpm test:db`.

`pnpm verify` checks generated Astryx font-floor CSS, then chains typecheck,
lint, test, and build, stopping at the first failure. After upgrading Astryx,
run `pnpm astryx:font-floor` and review the regenerated stylesheet. The check
fails on stale output or an unsupported dependency CSS shape.

CI runs unit/provider-handler tests and build checks, local pgTAP and concurrent
transaction tests, and a separate Playwright browser job (Chromium and WebKit).
The browser suite covers local auth/onboarding, contacts and merging, membership,
assignment, scrolling, keyboard focus, and English/Russian light/dark layouts.
See `AGENTS.md` for the current validation rules.

### Outbound delivery recovery

Sending claims a message atomically before contacting its provider. Known
provider rejections release that claim and mark the message failed. A timeout,
unreadable response, or database failure after provider acceptance keeps the
claim: retrying an ambiguous delivery automatically can send the customer a
duplicate. The UI reports that delivery needs verification.

For an uncertain delivery, an operator must inspect the provider first. If it
was accepted, reconcile the existing message's provider ID/status. Only after
confirming it was rejected may an authorized service call
`release_outbound_message` to permit a retry. Never release solely because a
timeout elapsed. These RPCs are unavailable to browser roles.

Meta delivery receipts are retained in the provider event ledger and reconciled
after the outbound provider ID is saved. A repeated accepted-send request also
retries reconciliation without sending again. After a database outage, operators
can call the service-only `reconcile_outbound_receipts` helper; there is no
automatic background replay worker.

Existing Telegram channels need a controlled reconnect to replace the old
channel-ID-derived webhook secret with a random secret. Apply the contact-save,
phone-replacement, dispatch, receipt and preflight-guard migrations before
releasing the updated frontend and sending functions. Hosted
migrations, function deployments, account rotation, and reconnects require
separate authorization; the audit does not perform them.

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
