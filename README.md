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
pnpm db:migrate:local   # apply D1 migrations to the local database (.wrangler/)
pnpm db:seed:local      # load placeholder services
pnpm dev                # API on http://localhost:8787, web on http://localhost:5173
```

No Cloudflare account or secrets are needed for local development.

Check it works:

```bash
curl http://localhost:8787/api/v1/health
curl http://localhost:8787/api/v1/services
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

## API conventions

All routes are under `/api/v1`. Success responses use `{ "data": ... }`. Errors use `{ "error": { "code", "message", "details?" } }`. Money is integer minor units with an explicit `currency` (e.g. `150000` + `"KES"` = KES 1,500).
