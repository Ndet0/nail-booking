import { fileURLToPath } from "node:url";
import { hashPassword } from "better-auth/crypto";
import { getPlatformProxy } from "wrangler";

const mode = process.argv[2];
if (mode !== "create" && mode !== "set-password") {
  console.error("Usage: node scripts/admin-account.mjs <create|set-password>");
  process.exit(1);
}

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
const password = process.env.ADMIN_PASSWORD ?? "";
const name = process.env.ADMIN_NAME?.trim() || "Chao";

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Set ADMIN_EMAIL to a valid email address.");
  process.exit(1);
}
if (password.length < 8 || password.length > 128) {
  console.error("Set ADMIN_PASSWORD to 8–128 characters. It is not written to the repo.");
  process.exit(1);
}
if (name.length < 1 || name.length > 80) {
  console.error("ADMIN_NAME must be 1–80 characters.");
  process.exit(1);
}

const { env, dispose } = await getPlatformProxy({
  configPath: fileURLToPath(new URL("../wrangler.jsonc", import.meta.url)),
});

try {
  const existing = await env.DB.prepare("SELECT id FROM user WHERE email = ?").bind(email).first();
  const hash = await hashPassword(password);
  const now = Date.now();

  if (mode === "create") {
    if (existing) {
      console.error("That email already has an account. Use pnpm admin:set-password to change it.");
      process.exit(1);
    }
    const userId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO user (id, name, email, email_verified, image, created_at, updated_at)
         VALUES (?, ?, ?, 1, NULL, ?, ?)`,
      ).bind(userId, name, email, now, now),
      env.DB.prepare(
        `INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
         VALUES (?, ?, 'credential', ?, ?, ?, ?)`,
      ).bind(crypto.randomUUID(), userId, userId, hash, now, now),
      env.DB.prepare("INSERT INTO admins (id, user_id, role) VALUES (?, ?, 'admin')").bind(
        crypto.randomUUID(),
        userId,
      ),
    ]);
    console.log(`Created administrator ${email}.`);
  } else {
    if (!existing?.id) {
      console.error("No account uses that email. Run pnpm admin:create first.");
      process.exit(1);
    }
    const admin = await env.DB.prepare("SELECT id FROM admins WHERE user_id = ?")
      .bind(existing.id)
      .first();
    if (!admin) {
      console.error("That account is not an administrator.");
      process.exit(1);
    }
    const result = await env.DB.prepare(
      `UPDATE account SET password = ?, updated_at = ?
       WHERE user_id = ? AND provider_id = 'credential'`,
    )
      .bind(hash, now, existing.id)
      .run();
    if (!result.meta.changes) {
      console.error("That administrator has no password to replace.");
      process.exit(1);
    }
    await env.DB.prepare("DELETE FROM session WHERE user_id = ?").bind(existing.id).run();
    console.log(`Updated the password for ${email} and signed out existing sessions.`);
  }
} finally {
  await dispose();
}
