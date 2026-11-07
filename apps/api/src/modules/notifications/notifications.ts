import type {
  BookingStatus,
  NotificationDto,
  NotificationKind,
  NotificationListDto,
} from "@nailsbychao/types";
import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import type { Db } from "../../db/client";
import { appointments, bookingLookupAttempts, notifications } from "../../db/schema";
import { AppError } from "../../utils/errors";

export type NotificationDraft = {
  audience: "admin" | "customer";
  appointmentId: string;
  kind: NotificationKind;
  title: string;
  body: string;
};

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

const whenFormatter = new Intl.DateTimeFormat("en-KE", {
  timeZone: "Africa/Nairobi",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatStudioWhen(instant: string): string {
  return whenFormatter.format(new Date(instant));
}

function notificationValues(draft: NotificationDraft) {
  return {
    id: `ntf_${crypto.randomUUID().replaceAll("-", "")}`,
    audience: draft.audience,
    appointmentId: draft.appointmentId,
    kind: draft.kind,
    title: draft.title,
    body: draft.body,
    createdAt: new Date().toISOString(),
  };
}

export function notificationInsert(db: Db, draft: NotificationDraft) {
  return db.insert(notifications).values(notificationValues(draft));
}

/**
 * Inserts only when the previous statement in the batch changed a row.
 * Place it immediately after that write, before any other change.
 */
export function notificationInsertIfChanged(db: Db, draft: NotificationDraft) {
  const row = notificationValues(draft);
  return db.insert(notifications).select(
    db
      .select({
        id: sql<string>`${row.id}`.as("id"),
        audience: sql<string>`${row.audience}`.as("audience"),
        appointmentId: sql<string>`${row.appointmentId}`.as("appointment_id"),
        kind: sql<string>`${row.kind}`.as("kind"),
        title: sql<string>`${row.title}`.as("title"),
        body: sql<string>`${row.body}`.as("body"),
        readAt: sql<string | null>`NULL`.as("read_at"),
        createdAt: sql<string>`${row.createdAt}`.as("created_at"),
      })
      .from(appointments)
      .where(and(eq(appointments.id, draft.appointmentId), sql`changes() = 1`)),
  );
}

/** Counts this address, then records the attempt. Expired rows are removed first. */
export async function assertLookupAllowed(db: Db, ipHash: string, now = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - WINDOW_MS).toISOString();
  await db.delete(bookingLookupAttempts).where(lt(bookingLookupAttempts.createdAt, cutoff));
  const recent = await db
    .select({ n: sql<number>`count(*)` })
    .from(bookingLookupAttempts)
    .where(eq(bookingLookupAttempts.ipHash, ipHash))
    .get();
  if (Number(recent?.n ?? 0) >= MAX_ATTEMPTS) {
    throw new AppError(429, "rate_limited", "Too many attempts. Try again in a little while.");
  }
  await db.insert(bookingLookupAttempts).values({
    id: crypto.randomUUID(),
    ipHash,
    createdAt: now.toISOString(),
  });
}

export function customerStatusNotification(
  appointment: { id: string; bookingReference: string },
  next: BookingStatus,
): NotificationDraft | null {
  const reference = appointment.bookingReference;
  const copy: Partial<Record<BookingStatus, Pick<NotificationDraft, "kind" | "title" | "body">>> = {
    confirmed: {
      kind: "booking_confirmed",
      title: "Booking confirmed",
      body: `Chao confirmed ${reference}.`,
    },
    cancelled: {
      kind: "booking_cancelled",
      title: "Booking cancelled",
      body: `Chao cancelled ${reference}.`,
    },
    completed: {
      kind: "booking_completed",
      title: "Appointment complete",
      body: `${reference} is complete.`,
    },
    no_show: {
      kind: "booking_no_show",
      title: "Missed appointment",
      body: `${reference} was marked as a no-show.`,
    },
  };
  const chosen = copy[next];
  if (!chosen) return null;
  return { audience: "customer", appointmentId: appointment.id, ...chosen };
}

type Audience = NotificationDraft["audience"];

export async function listNotifications(
  db: Db,
  audience: Audience,
  appointmentId?: string,
): Promise<NotificationListDto> {
  const rows = await db
    .select({ notification: notifications, bookingReference: appointments.bookingReference })
    .from(notifications)
    .innerJoin(appointments, eq(appointments.id, notifications.appointmentId))
    .where(
      and(
        eq(notifications.audience, audience),
        appointmentId ? eq(notifications.appointmentId, appointmentId) : undefined,
      ),
    )
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(50);

  const unread = await db
    .select({ n: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.audience, audience),
        isNull(notifications.readAt),
        appointmentId ? eq(notifications.appointmentId, appointmentId) : undefined,
      ),
    )
    .get();

  return {
    items: rows.map((row) => toDto(row.notification, row.bookingReference)),
    unreadCount: Number(unread?.n ?? 0),
  };
}

export async function markNotificationRead(
  db: Db,
  audience: Audience,
  id: string,
  appointmentId?: string,
): Promise<boolean> {
  const scope = and(
    eq(notifications.id, id),
    eq(notifications.audience, audience),
    appointmentId ? eq(notifications.appointmentId, appointmentId) : undefined,
  );
  await db
    .update(notifications)
    .set({ readAt: new Date().toISOString() })
    .where(and(scope, isNull(notifications.readAt)));
  const existing = await db.select({ id: notifications.id }).from(notifications).where(scope).get();
  return Boolean(existing);
}

export async function markAllNotificationsRead(
  db: Db,
  audience: Audience,
  appointmentId?: string,
): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date().toISOString() })
    .where(
      and(
        eq(notifications.audience, audience),
        isNull(notifications.readAt),
        appointmentId ? eq(notifications.appointmentId, appointmentId) : undefined,
      ),
    );
}

function toDto(row: typeof notifications.$inferSelect, bookingReference: string): NotificationDto {
  return {
    id: row.id,
    audience: row.audience,
    appointmentId: row.appointmentId,
    bookingReference,
    kind: row.kind,
    title: row.title,
    body: row.body,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}
