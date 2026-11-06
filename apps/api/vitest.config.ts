import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  // Read migrations in Node.js; test/apply-migrations.ts applies them to the test D1 inside workerd.
  const migrations = await readD1Migrations(
    fileURLToPath(new URL("./migrations", import.meta.url).href),
  );

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            ENVIRONMENT: "test",
            TEST_MIGRATIONS: migrations,
            BETTER_AUTH_SECRET: "test-only-better-auth-secret-32chars",
            BETTER_AUTH_URL: "http://localhost:5173",
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
    },
  };
});
