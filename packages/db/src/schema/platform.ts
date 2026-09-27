import { user } from "@db/schema/auth";
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamp = (name: string) =>
  integer(name, { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull();

export const auditLogActions = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGOUT",
  "ASSIGN_ROLE",
  "REVOKE_ROLE",
  "EXPORT",
] as const;

export const notificationStatuses = ["UNREAD", "READ"] as const;

export const jobStatuses = [
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "PARTIAL_FAILED",
  "FAILED",
  "CANCELLED",
] as const;

export const fileObjectStatuses = [
  "PENDING",
  "ACTIVE",
  "DELETED",
  "ORPHANED",
] as const;

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    action: text("action").notNull(),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    afterState: text("after_state"),
    beforeState: text("before_state"),
    createdAt: timestamp("created_at"),
    entityId: text("entity_id"),
    entityType: text("entity_type"),
    id: text("id").primaryKey(),
    metadata: text("metadata"),
    requestId: text("request_id"),
  },
  (table) => [
    index("audit_logs_actor_created_at_idx").on(
      table.actorUserId,
      table.createdAt
    ),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  ]
);

export const notifications = sqliteTable(
  "notifications",
  {
    body: text("body").notNull(),
    createdAt: timestamp("created_at"),
    id: text("id").primaryKey(),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    route: text("route"),
    status: text("status").default("UNREAD").notNull(),
    title: text("title").notNull(),
    type: text("type").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("notifications_user_status_created_at_idx").on(
      table.userId,
      table.status,
      table.createdAt
    ),
  ]
);

export const outboxEvents = sqliteTable(
  "outbox_events",
  {
    aggregateId: text("aggregate_id"),
    aggregateType: text("aggregate_type"),
    attempts: integer("attempts").default(0).notNull(),
    availableAt: integer("available_at", { mode: "timestamp_ms" }),
    createdAt: timestamp("created_at"),
    eventType: text("event_type").notNull(),
    id: text("id").primaryKey(),
    lastError: text("last_error"),
    payload: text("payload").notNull(),
    processedAt: integer("processed_at", { mode: "timestamp_ms" }),
    status: text("status").default("PENDING").notNull(),
  },
  (table) => [
    index("outbox_events_status_available_at_idx").on(
      table.status,
      table.availableAt
    ),
  ]
);

export const idempotencyKeys = sqliteTable(
  "idempotency_keys",
  {
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    resultReference: text("result_reference"),
    scope: text("scope").notNull(),
    status: text("status").default("PENDING").notNull(),
  },
  (table) => [
    uniqueIndex("idempotency_keys_scope_key_uq").on(table.scope, table.key),
    index("idempotency_keys_expires_at_idx").on(table.expiresAt),
  ]
);

export const fileObjects = sqliteTable(
  "file_objects",
  {
    checksum: text("checksum").notNull(),
    createdAt: timestamp("created_at"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    declaredMime: text("declared_mime"),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    id: text("id").primaryKey(),
    mimeType: text("mime_type").notNull(),
    objectKey: text("object_key").notNull(),
    originalFilename: text("original_filename").notNull(),
    ownerId: text("owner_id").notNull(),
    ownerType: text("owner_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    status: text("status").default("PENDING").notNull(),
  },
  (table) => [
    uniqueIndex("file_objects_object_key_uq").on(table.objectKey),
    index("file_objects_owner_idx").on(table.ownerType, table.ownerId),
    index("file_objects_status_idx").on(table.status),
  ]
);

export const backgroundJobs = sqliteTable(
  "background_jobs",
  {
    completedCount: integer("completed_count").default(0).notNull(),
    createdAt: timestamp("created_at"),
    cursor: text("cursor"),
    errorCount: integer("error_count").default(0).notNull(),
    errorMessage: text("error_message"),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key"),
    jobType: text("job_type").notNull(),
    leaseExpiresAt: integer("lease_expires_at", { mode: "timestamp_ms" }),
    leaseOwner: text("lease_owner"),
    processedCount: integer("processed_count").default(0).notNull(),
    status: text("status").default("PENDING").notNull(),
    totalCount: integer("total_count"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    index("background_jobs_status_lease_idx").on(
      table.status,
      table.leaseExpiresAt
    ),
    index("background_jobs_type_created_at_idx").on(
      table.jobType,
      table.createdAt
    ),
  ]
);
