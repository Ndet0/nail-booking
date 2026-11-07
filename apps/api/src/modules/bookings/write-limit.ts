import { and, eq, lt, sql } from "drizzle-orm";
import type { Db } from "../../db/client";
import { bookingWriteAttempts } from "../../db/schema";
import { AppError } from "../../utils/errors";
import { sha256Hex } from "./bookings.repository";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export type BookingWriteKind = "create" | "cancel" | "reschedule";

/** SHA-256 of `cf-connecting-ip`, or of `unknown` when the header is missing. */
export async function clientAddressHash(header: string | undefined): Promise<string> {
  return sha256Hex(header?.trim() || "unknown");
}

/**
 * Counts this address for one write kind, then records the attempt.
 * Throws before the booking batch when the window is already full, so a
 * refused request cannot insert an appointment or change one.
 */
export async function assertBookingWriteAllowed(
  db: Db,
  ipHash: string,
  kind: BookingWriteKind,
  now = new Date(),
): Promise<void> {
  const cutoff = new Date(now.getTime() - WINDOW_MS).toISOString();
  await db.delete(bookingWriteAttempts).where(lt(bookingWriteAttempts.createdAt, cutoff));
  const recent = await db
    .select({ n: sql<number>`count(*)` })
    .from(bookingWriteAttempts)
    .where(and(eq(bookingWriteAttempts.ipHash, ipHash), eq(bookingWriteAttempts.kind, kind)))
    .get();
  if (Number(recent?.n ?? 0) >= MAX_ATTEMPTS) {
    throw new AppError(429, "rate_limited", "Too many attempts. Try again in a little while.");
  }
  await db.insert(bookingWriteAttempts).values({
    id: crypto.randomUUID(),
    ipHash,
    kind,
    createdAt: now.toISOString(),
  });
}
