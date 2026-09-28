import { user } from "@db/schema/auth";
import { fileObjects } from "@db/schema/platform";
import { classMeetings, classSections } from "@db/schema/scheduling";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamp = (name: string) =>
  integer(name, { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull();

export const attendanceParticipantTypes = ["STUDENT", "LECTURER"] as const;
export const attendanceStatuses = ["HADIR", "IZIN", "SAKIT", "ALPA"] as const;
export const attendanceRequestStatuses = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;
export const attendanceReviewDecisions = ["APPROVED", "REJECTED"] as const;
export const attendanceEvidenceTypes = ["PHOTO"] as const;
export const attendanceJobStatuses = [
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "PARTIAL_FAILED",
  "FAILED",
] as const;

export const attendanceSessions = sqliteTable(
  "attendance_sessions",
  {
    classSectionId: text("class_section_id")
      .notNull()
      .references(() => classSections.id, { onDelete: "cascade" }),
    closeAt: integer("close_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: timestamp("created_at"),
    endAt: integer("end_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    meetingId: text("meeting_id")
      .notNull()
      .references(() => classMeetings.id, { onDelete: "cascade" }),
    modality: text("modality").notNull(),
    openAt: integer("open_at", { mode: "timestamp_ms" }).notNull(),
    policyRadiusMeters: real("policy_radius_meters").notNull(),
    policyVersion: text("policy_version").notNull(),
    scheduleRevisionId: text("schedule_revision_id"),
    startAt: integer("start_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("attendance_sessions_meeting_uq").on(table.meetingId),
    index("attendance_sessions_window_idx").on(table.openAt, table.closeAt),
  ]
);

export const attendanceCaptureAttempts = sqliteTable(
  "attendance_capture_attempts",
  {
    createdAt: timestamp("created_at"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    modality: text("modality").notNull(),
    nonceHash: text("nonce_hash").notNull(),
    participantId: text("participant_id").notNull(),
    participantType: text("participant_type").notNull(),
    sessionId: text("session_id")
      .notNull()
      .references(() => attendanceSessions.id, { onDelete: "cascade" }),
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("attendance_capture_attempts_nonce_uq").on(table.nonceHash),
    index("attendance_capture_attempts_participant_idx").on(
      table.participantType,
      table.participantId,
      table.expiresAt
    ),
  ]
);

export const attendanceRecords = sqliteTable(
  "attendance_records",
  {
    createdAt: timestamp("created_at"),
    id: text("id").primaryKey(),
    note: text("note"),
    participantId: text("participant_id").notNull(),
    participantType: text("participant_type").notNull(),
    sessionId: text("session_id")
      .notNull()
      .references(() => attendanceSessions.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: timestamp("updated_at"),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    uniqueIndex("attendance_records_participant_session_uq").on(
      table.sessionId,
      table.participantType,
      table.participantId
    ),
    index("attendance_records_session_status_idx").on(
      table.sessionId,
      table.status
    ),
  ]
);

export const attendanceEvidences = sqliteTable(
  "attendance_evidences",
  {
    accuracyMeters: real("accuracy_meters"),
    attendanceRecordId: text("attendance_record_id")
      .notNull()
      .references(() => attendanceRecords.id, { onDelete: "cascade" }),
    captureAttemptId: text("capture_attempt_id")
      .notNull()
      .references(() => attendanceCaptureAttempts.id, { onDelete: "restrict" }),
    capturedAt: integer("captured_at", { mode: "timestamp_ms" }).notNull(),
    checksum: text("checksum").notNull(),
    createdAt: timestamp("created_at"),
    dimensionHeight: integer("dimension_height").notNull(),
    dimensionWidth: integer("dimension_width").notNull(),
    distanceMeters: real("distance_meters"),
    evidenceType: text("evidence_type").notNull(),
    fileObjectId: text("file_object_id")
      .notNull()
      .references(() => fileObjects.id, { onDelete: "restrict" }),
    id: text("id").primaryKey(),
    latitude: real("latitude"),
    longitude: real("longitude"),
    mimeType: text("mime_type").notNull(),
    policyRadiusMeters: real("policy_radius_meters").notNull(),
    referenceLatitude: real("reference_latitude"),
    referenceLongitude: real("reference_longitude"),
    sizeBytes: integer("size_bytes").notNull(),
  },
  (table) => [
    uniqueIndex("attendance_evidences_record_uq").on(table.attendanceRecordId),
    index("attendance_evidences_file_idx").on(table.fileObjectId),
    check(
      "attendance_evidences_coordinate_pair_ck",
      sql`(${table.latitude} IS NULL AND ${table.longitude} IS NULL) OR (${table.latitude} IS NOT NULL AND ${table.longitude} IS NOT NULL)`
    ),
  ]
);

export const attendanceRequests = sqliteTable(
  "attendance_requests",
  {
    attendanceRecordId: text("attendance_record_id")
      .notNull()
      .references(() => attendanceRecords.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
    decidedBy: text("decided_by").references(() => user.id, {
      onDelete: "set null",
    }),
    decisionReason: text("decision_reason"),
    id: text("id").primaryKey(),
    requestedStatus: text("requested_status").notNull(),
    status: text("status").default("PENDING").notNull(),
  },
  (table) => [
    uniqueIndex("attendance_requests_record_uq").on(table.attendanceRecordId),
    index("attendance_requests_status_created_idx").on(
      table.status,
      table.createdAt
    ),
  ]
);

export const attendanceAdjustments = sqliteTable(
  "attendance_adjustments",
  {
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    attendanceRecordId: text("attendance_record_id")
      .notNull()
      .references(() => attendanceRecords.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
    fromStatus: text("from_status").notNull(),
    id: text("id").primaryKey(),
    reason: text("reason").notNull(),
    toStatus: text("to_status").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    index("attendance_adjustments_record_idx").on(table.attendanceRecordId),
  ]
);

export const attendanceReviewLogs = sqliteTable(
  "attendance_review_logs",
  {
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    attendanceRequestId: text("attendance_request_id")
      .notNull()
      .references(() => attendanceRequests.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
    decision: text("decision").notNull(),
    id: text("id").primaryKey(),
    reason: text("reason"),
  },
  (table) => [
    index("attendance_review_logs_request_idx").on(table.attendanceRequestId),
  ]
);

export const attendanceGenerationJobs = sqliteTable(
  "attendance_generation_jobs",
  {
    completedCount: integer("completed_count").default(0).notNull(),
    createdAt: timestamp("created_at"),
    cursor: text("cursor"),
    errorCount: integer("error_count").default(0).notNull(),
    errorDetails: text("error_details"),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    processedCount: integer("processed_count").default(0).notNull(),
    sessionId: text("session_id")
      .notNull()
      .references(() => attendanceSessions.id, { onDelete: "cascade" }),
    status: text("status").default("PENDING").notNull(),
    totalCount: integer("total_count").default(0).notNull(),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("attendance_generation_jobs_session_key_uq").on(
      table.sessionId,
      table.idempotencyKey
    ),
    index("attendance_generation_jobs_status_idx").on(
      table.status,
      table.updatedAt
    ),
  ]
);
