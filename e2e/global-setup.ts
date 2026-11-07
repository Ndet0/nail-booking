import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { E2E_ADMIN } from "./admin";

const exec = promisify(execFile);

/** Applies local migrations, then makes sure the e2e administrator can sign in. */
export default async function globalSetup(): Promise<void> {
  const env = {
    ...process.env,
    ADMIN_EMAIL: E2E_ADMIN.email,
    ADMIN_PASSWORD: E2E_ADMIN.password,
    ADMIN_NAME: E2E_ADMIN.name,
  };
  await exec("pnpm", ["db:migrate:local"], { env, cwd: process.cwd() });
  try {
    await exec("pnpm", ["admin:create"], { env, cwd: process.cwd() });
  } catch (error) {
    if (!errorText(error).includes("already has an account")) throw error;
    await exec("pnpm", ["admin:set-password"], { env, cwd: process.cwd() });
  }
}

function errorText(error: unknown): string {
  if (typeof error === "object" && error && "stderr" in error) {
    return String((error as { stderr?: unknown }).stderr ?? "");
  }
  return error instanceof Error ? error.message : String(error);
}
