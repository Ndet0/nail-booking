import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Runs before each test file against the real (local) D1 binding. Already-applied migrations are skipped.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
