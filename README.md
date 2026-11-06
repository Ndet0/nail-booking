# NAILSBYCHAO

Online booking platform for **Chao**, nail tech and makeup artist ([@nailsbychao_](https://www.instagram.com/nailsbychao_/)). Home-based studio and house calls in Kenya.

Customers browse services, see real availability and book online. Chao manages bookings, services, schedule and gallery from an admin dashboard.

## Docs

- [Product architecture](docs/PRODUCT_ARCHITECTURE.md)
- [Technical architecture](docs/TECHNICAL_ARCHITECTURE.md)
- [Sprint plan](docs/SPRINT.md)
- [Business rules](docs/BUSINESS_RULES.md): confirmed decisions and open questions

## Stack

pnpm + Turborepo · TypeScript · React + Vite + Tailwind (`apps/web`) · Hono on Cloudflare Workers (`apps/api`) · Cloudflare D1 + Drizzle · Zod · Vitest · Biome

```text
apps/
  api/      Hono API (Cloudflare Worker), D1 migrations and seed data
  web/      React customer and admin app
packages/
  types/    API contracts shared by web and api
docs/
```

## Getting started

Prerequisites: Node.js 22+ (see `.nvmrc`) and pnpm 11 (`corepack enable`).

```bash
pnpm install
cp apps/api/.dev.vars.example apps/api/.dev.vars
# Put a 32+ character BETTER_AUTH_SECRET in apps/api/.dev.vars. The example shows how to generate one.
pnpm db:migrate:local   # apply D1 migrations to the local database (.wrangler/)
pnpm db:seed:local      # load placeholder services, then Chao's proposed weekly hours
pnpm dev                # API on http://localhost:8787, web on http://localhost:5173
```

No Cloudflare account is needed for local development. The auth secret stays in `.dev.vars` and is not committed. R2 gallery storage is emulated locally.

Create the first administrator after the migration. The password is read from the environment and is not written to the repo. If that email already exists, the command stops. `pnpm admin:set-password` replaces the password for an existing administrator.

```bash
ADMIN_EMAIL=chao@example.com ADMIN_PASSWORD='a-long-password' ADMIN_NAME=Chao pnpm admin:create
```

Sign in at http://localhost:5173/admin/login. The public home page shows published gallery images only.

Check it works:

```bash
curl http://localhost:8787/api/v1/health
curl http://localhost:8787/api/v1/services
```

## Local D1 database

The local database (`nailsbychao-db`) is a SQLite file Wrangler keeps under `apps/api/.wrangler/state/v3/d1/`. Every command below uses `--local`, so none of them touch a remote database. Run the `wrangler` commands from `apps/api`; the `pnpm db:*` scripts work from the repo root.

### Migrations

```bash
pnpm db:migrate:local                                        # apply pending migrations
cd apps/api
pnpm exec wrangler d1 migrations list nailsbychao-db --local # show migrations not yet applied
```

After changing `apps/api/src/db/schema.ts`, generate a migration with `pnpm --filter @nailsbychao/api db:generate`, review the new file in `apps/api/migrations/`, then run `pnpm db:migrate:local`.

### Seed data

```bash
pnpm db:seed:local
```

Seeding deletes all appointments, slot reservations, staff hours, time off and services before loading `seed/services.sql` and `seed/schedule.sql`. Any test bookings are lost.

### Query

```bash
cd apps/api
# List tables
pnpm exec wrangler d1 execute nailsbychao-db --local --command "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;"
# Show a table's columns
pnpm exec wrangler d1 execute nailsbychao-db --local --command "PRAGMA table_info(appointments);"
# Bookings
pnpm exec wrangler d1 execute nailsbychao-db --local --command "SELECT booking_reference, customer_name, customer_phone, start_at, status, location FROM appointments ORDER BY start_at;"
# Slots held by bookings
pnpm exec wrangler d1 execute nailsbychao-db --local --command "SELECT staff_id, slot_start_at, appointment_id FROM appointment_slot_reservations ORDER BY slot_start_at;"
# Run a SQL file
pnpm exec wrangler d1 execute nailsbychao-db --local --file path/to/query.sql
```

### Clear test bookings

Keeps services and schedule; removes every booking and the slots it holds.

```bash
cd apps/api
pnpm exec wrangler d1 execute nailsbychao-db --local --command "DELETE FROM appointment_slot_reservations; DELETE FROM appointments;"
```

### Back up and restore

```bash
cd apps/api
pnpm exec wrangler d1 export nailsbychao-db --local --output backup.sql            # schema and data
pnpm exec wrangler d1 export nailsbychao-db --local --output data.sql --no-schema  # data only
```

To restore, reset the database (below), then run `pnpm exec wrangler d1 execute nailsbychao-db --local --file backup.sql`. Don't commit backups; they contain customer names and phone numbers.

### Reset from scratch

Stop `pnpm dev` first so Wrangler isn't holding the file.

```bash
rm -rf apps/api/.wrangler/state/v3/d1
pnpm db:migrate:local
pnpm db:seed:local
```

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run the API (Wrangler) and web app (Vite) together |
| `pnpm build` | Production build |
| `pnpm typecheck` | TypeScript checks for all workspaces |
| `pnpm test` | API tests against a local D1 (workerd) |
| `pnpm lint` | Biome lint and format check |
| `pnpm format` | Biome format (writes changes) |
| `pnpm --filter @nailsbychao/api db:generate` | Generate a new migration after changing `apps/api/src/db/schema.ts` |
| `pnpm admin:create` | Create the first administrator from `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_NAME` |
| `pnpm admin:set-password` | Replace that administrator's password and sign them out |

## API conventions

All routes are under `/api/v1`. Success responses use `{ "data": ... }`. Errors use `{ "error": { "code", "message", "details?" } }`. Money is integer minor units with an explicit `currency` (e.g. `150000` + `"KES"` = KES 1,500).
