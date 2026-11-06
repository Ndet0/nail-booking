import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb } from "../../db/client";
import { account, rateLimit, session, user, verification } from "../../db/schema";
import { type Bindings, getConfig } from "../../env";

type Auth = ReturnType<typeof betterAuth>;

const cache = new WeakMap<object, Auth>();

/** One Better Auth instance per Worker env. Do not construct it at module scope. */
export function createAuth(env: Bindings): Auth {
  const cached = cache.get(env);
  if (cached) return cached;

  const config = getConfig(env);
  const auth = betterAuth({
    baseURL: config.BETTER_AUTH_URL,
    basePath: "/api/auth",
    secret: config.BETTER_AUTH_SECRET,
    trustedOrigins: config.CORS_ORIGINS,
    database: drizzleAdapter(createDb(env.DB), {
      provider: "sqlite",
      schema: { user, session, account, verification, rateLimit },
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 8,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: config.ENVIRONMENT === "test" ? 1_000 : 100,
      customRules: {
        // Paths are relative to basePath. This replaces the built-in 3-per-10s sign-in rule.
        "/sign-in/email": {
          window: 60,
          max: config.ENVIRONMENT === "test" ? 1_000 : 10,
        },
      },
    },
    advanced: {
      // Cloudflare sets this header at the edge. Clients can spoof X-Forwarded-For.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      useSecureCookies: config.ENVIRONMENT === "production",
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: config.ENVIRONMENT === "production",
      },
    },
  });

  const stored = auth as unknown as Auth;
  cache.set(env, stored);
  return stored;
}
