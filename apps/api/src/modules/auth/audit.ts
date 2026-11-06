import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../../db/client";
import { auditEvents, user } from "../../db/schema";

export type AuditEvent = {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
};

/** Insert statement for an audit row. Callers include it in the same D1 batch as the change. */
export function auditInsert(db: Db, event: AuditEvent) {
  return db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    actorId: event.actorId,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
  });
}

/**
 * Audit insert that only runs when the statement just before it in the batch changed a row.
 * It must come directly after that statement, because `changes()` reads the last write.
 */
export function auditInsertIfChanged(db: Db, event: AuditEvent) {
  return db.insert(auditEvents).select(
    db
      .select({
        id: sql<string>`${crypto.randomUUID()}`.as("id"),
        actorId: user.id,
        action: sql<string>`${event.action}`.as("action"),
        entityType: sql<string>`${event.entityType}`.as("entity_type"),
        entityId: sql<string>`${event.entityId}`.as("entity_id"),
        createdAt: sql<string>`${new Date().toISOString()}`.as("created_at"),
      })
      .from(user)
      .where(and(eq(user.id, event.actorId), sql`changes() = 1`)),
  );
}
