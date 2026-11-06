import type { Db } from "../../db/client";

/** D1 runs the statements atomically. The cast matches Drizzle's tuple-shaped batch API. */
export async function runBatch(db: Db, statements: readonly object[]): Promise<readonly unknown[]> {
  if (statements.length === 0) return [];
  return db.batch(statements as unknown as Parameters<Db["batch"]>[0]);
}
