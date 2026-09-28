import { user } from "@db/schema/auth";
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamp = (name: string) =>
  integer(name, { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull();

export const identityTypes = [
  "MAHASISWA",
  "DOSEN",
  "ADMIN_AKADEMIK",
  "ADMIN_KEUANGAN",
  "SUPERADMIN",
] as const;

export const identityAccountStatuses = ["ACTIVE", "INACTIVE"] as const;

export const provisioningStatuses = [
  "PENDING_PROVISIONING",
  "PROVISIONED",
  "FAILED",
] as const;

export const roleKeys = [
  "SUPERADMIN",
  "ADMIN_AKADEMIK",
  "ADMIN_KEUANGAN",
  "KAPRODI",
  "DOSEN",
  "MAHASISWA",
] as const;

export const scopeTypes = ["PRODI", "KELAS", "OWNERSHIP"] as const;

export const identityAccounts = sqliteTable(
  "identity_accounts",
  {
    createdAt: timestamp("created_at"),
    deactivatedAt: integer("deactivated_at", { mode: "timestamp_ms" }),
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    identityType: text("identity_type").notNull(),
    mustChangePassword: integer("must_change_password", {
      mode: "boolean",
    })
      .default(true)
      .notNull(),
    phone: text("phone"),
    status: text("status").default("ACTIVE").notNull(),
    temporaryPasswordExpiresAt: integer("temporary_password_expires_at", {
      mode: "timestamp_ms",
    }),
    updatedAt: timestamp("updated_at"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("identity_accounts_identifier_uq").on(table.identifier),
    uniqueIndex("identity_accounts_user_id_uq").on(table.userId),
    index("identity_accounts_status_type_idx").on(
      table.status,
      table.identityType
    ),
  ]
);

export const emailChangeRequests = sqliteTable(
  "email_change_requests",
  {
    createdAt: timestamp("created_at"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    newEmail: text("new_email").notNull(),
    status: text("status").default("PENDING").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verificationTokenHash: text("verification_token_hash").notNull(),
    verifiedAt: integer("verified_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("email_change_requests_user_status_idx").on(
      table.userId,
      table.status
    ),
    index("email_change_requests_token_hash_idx").on(
      table.verificationTokenHash
    ),
  ]
);

export const roles = sqliteTable("roles", {
  description: text("description").notNull(),
  key: text("key").primaryKey(),
  name: text("name").notNull(),
});

export const permissions = sqliteTable("permissions", {
  description: text("description").notNull(),
  key: text("key").primaryKey(),
});

export const rolePermissions = sqliteTable(
  "role_permissions",
  {
    permissionKey: text("permission_key")
      .notNull()
      .references(() => permissions.key, { onDelete: "cascade" }),
    roleKey: text("role_key")
      .notNull()
      .references(() => roles.key, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.roleKey, table.permissionKey] })]
);

export const userRoles = sqliteTable(
  "user_roles",
  {
    assignedAt: timestamp("assigned_at"),
    assignedBy: text("assigned_by").references(() => user.id, {
      onDelete: "set null",
    }),
    id: text("id").primaryKey(),
    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
    roleKey: text("role_key")
      .notNull()
      .references(() => roles.key, { onDelete: "restrict" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("user_roles_active_uq").on(
      table.userId,
      table.roleKey,
      table.isActive
    ),
    index("user_roles_user_active_idx").on(table.userId, table.isActive),
  ]
);

export const userScopes = sqliteTable(
  "user_scopes",
  {
    createdAt: timestamp("created_at"),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }),
    id: text("id").primaryKey(),
    scopeId: text("scope_id").notNull(),
    scopeType: text("scope_type").notNull(),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("user_scopes_active_uq").on(
      table.userId,
      table.scopeType,
      table.scopeId,
      table.startsAt
    ),
    index("user_scopes_user_type_idx").on(table.userId, table.scopeType),
  ]
);

export const roleConflicts = sqliteTable(
  "role_conflicts",
  {
    conflictingRoleKey: text("conflicting_role_key")
      .notNull()
      .references(() => roles.key, { onDelete: "cascade" }),
    roleKey: text("role_key")
      .notNull()
      .references(() => roles.key, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.roleKey, table.conflictingRoleKey] }),
  ]
);

export const identifierSequences = sqliteTable(
  "identifier_sequences",
  {
    nextValue: integer("next_value").default(1).notNull(),
    prefix: text("prefix").notNull(),
    sequenceDate: text("sequence_date").notNull(),
    version: integer("version").default(0).notNull(),
  },
  (table) => [primaryKey({ columns: [table.prefix, table.sequenceDate] })]
);

export const identifierReservations = sqliteTable(
  "identifier_reservations",
  {
    createdAt: timestamp("created_at"),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    identifier: text("identifier").notNull(),
    masterRecordId: text("master_record_id").notNull(),
    prefix: text("prefix").notNull(),
    sequenceDate: text("sequence_date").notNull(),
    sequenceNumber: integer("sequence_number").notNull(),
    status: text("status").default("RESERVED").notNull(),
  },
  (table) => [
    uniqueIndex("identifier_reservations_identifier_uq").on(table.identifier),
    uniqueIndex("identifier_reservations_idempotency_uq").on(
      table.idempotencyKey
    ),
    uniqueIndex("identifier_reservations_master_uq").on(table.masterRecordId),
  ]
);

export const programHeads = sqliteTable(
  "program_heads",
  {
    assignedAt: timestamp("assigned_at"),
    assignedBy: text("assigned_by").references(() => user.id, {
      onDelete: "set null",
    }),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }),
    id: text("id").primaryKey(),
    prodiId: text("prodi_id").notNull(),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("program_heads_prodi_active_idx").on(table.prodiId, table.endsAt),
    index("program_heads_user_idx").on(table.userId),
  ]
);

export const securityEvents = sqliteTable(
  "security_events",
  {
    createdAt: timestamp("created_at"),
    eventType: text("event_type").notNull(),
    id: text("id").primaryKey(),
    ipAddress: text("ip_address"),
    metadata: text("metadata"),
    requestId: text("request_id"),
    userAgent: text("user_agent"),
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("security_events_user_created_at_idx").on(
      table.userId,
      table.createdAt
    ),
    index("security_events_type_created_at_idx").on(
      table.eventType,
      table.createdAt
    ),
  ]
);

export const identityRelations = {
  identityAccount: {
    user: {
      from: identityAccounts.userId,
      to: user.id,
    },
  },
};
