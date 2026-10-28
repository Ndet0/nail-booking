import { z } from "zod";

export type Bindings = {
  DB: D1Database;
  ENVIRONMENT: string;
  CORS_ORIGINS: string;
};

const varsSchema = z.object({
  ENVIRONMENT: z.enum(["development", "test", "staging", "production"]),
  CORS_ORIGINS: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
});

export type Config = z.infer<typeof varsSchema>;

const cache = new WeakMap<object, Config>();

/** Validates Worker vars once per env object. Throws on misconfiguration. */
export function getConfig(env: Bindings): Config {
  const cached = cache.get(env);
  if (cached) return cached;
  const parsed = varsSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid Worker configuration: ${z.prettifyError(parsed.error)}`);
  }
  cache.set(env, parsed.data);
  return parsed.data;
}

export type AppEnv = {
  Bindings: Bindings;
};
