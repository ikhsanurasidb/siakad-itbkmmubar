import { user } from "@db/schema/auth";
import {
  academicPeriods,
  courses,
  lecturers,
  rooms,
  students,
  studyPrograms,
} from "@db/schema/master-data";
import { studyPlanItems, studyPlans } from "@db/schema/study-plan";
import { sql } from "drizzle-orm";
import {
  check,
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

export const classSectionStatuses = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "PUBLISHED",
] as const;
export const scheduleDraftStatuses = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "PUBLISHED",
] as const;
export const scheduleModalities = ["OFFLINE", "ONLINE"] as const;
export const scheduleConflictSeverities = ["BLOCKING", "WARNING"] as const;
export const scheduleChangeRequestStatuses = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;

export const classMappingJobs = sqliteTable(
  "class_mapping_jobs",
  {
    academicPeriodId: text("academic_period_id")
      .notNull()
      .references(() => academicPeriods.id, { onDelete: "restrict" }),
    checkpointGroupKey: text("checkpoint_group_key"),
    completedCount: integer("completed_count").default(0).notNull(),
    createdAt: timestamp("created_at"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    errorCount: integer("error_count").default(0).notNull(),
    failureDetails: text("failure_details"),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    processedCount: integer("processed_count").default(0).notNull(),
    status: text("status").default("PENDING").notNull(),
    studyProgramId: text("study_program_id").references(
      () => studyPrograms.id,
      { onDelete: "restrict" }
    ),
    totalCount: integer("total_count").default(0).notNull(),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("class_mapping_jobs_period_key_uq").on(
      table.academicPeriodId,
      table.idempotencyKey
    ),
    index("class_mapping_jobs_status_idx").on(table.status, table.updatedAt),
  ]
);

export const classSections = sqliteTable(
  "class_sections",
  {
    academicPeriodId: text("academic_period_id")
      .notNull()
      .references(() => academicPeriods.id, { onDelete: "restrict" }),
    capacity: integer("capacity").notNull(),
    code: text("code").notNull(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at"),
    id: text("id").primaryKey(),
    mappingJobId: text("mapping_job_id").references(() => classMappingJobs.id, {
      onDelete: "set null",
    }),
    policyLeadDays: integer("policy_lead_days").default(7).notNull(),
    policyMaxOnlineMeetings: integer("policy_max_online_meetings")
      .default(2)
      .notNull(),
    status: text("status").default("DRAFT").notNull(),
    studyProgramId: text("study_program_id")
      .notNull()
      .references(() => studyPrograms.id, { onDelete: "restrict" }),
    updatedAt: timestamp("updated_at"),
    version: integer("version").default(0).notNull(),
  },
  (table) => [
    uniqueIndex("class_sections_period_course_code_uq").on(
      table.academicPeriodId,
      table.courseId,
      table.code
    ),
    index("class_sections_program_period_status_idx").on(
      table.studyProgramId,
      table.academicPeriodId,
      table.status
    ),
    check("class_sections_capacity_positive_ck", sql`${table.capacity} > 0`),
  ]
);

export const classEnrollments = sqliteTable(
  "class_enrollments",
  {
    classSectionId: text("class_section_id")
      .notNull()
      .references(() => classSections.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    studyPlanId: text("study_plan_id")
      .notNull()
      .references(() => studyPlans.id, { onDelete: "restrict" }),
    studyPlanItemId: text("study_plan_item_id")
      .notNull()
      .references(() => studyPlanItems.id, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("class_enrollments_student_course_plan_uq").on(
      table.studentId,
      table.studyPlanItemId
    ),
    index("class_enrollments_class_idx").on(table.classSectionId),
  ]
);

export const teachingAssignments = sqliteTable(
  "teaching_assignments",
  {
    classSectionId: text("class_section_id")
      .notNull()
      .references(() => classSections.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
    id: text("id").primaryKey(),
    isPrimary: integer("is_primary", { mode: "boolean" })
      .default(false)
      .notNull(),
    lecturerId: text("lecturer_id")
      .notNull()
      .references(() => lecturers.id, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("teaching_assignments_class_lecturer_uq").on(
      table.classSectionId,
      table.lecturerId
    ),
    index("teaching_assignments_lecturer_idx").on(table.lecturerId),
  ]
);

export const lecturerAvailabilities = sqliteTable(
  "lecturer_availabilities",
  {
    academicPeriodId: text("academic_period_id")
      .notNull()
      .references(() => academicPeriods.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
    dayOfWeek: integer("day_of_week").notNull(),
    endMinute: integer("end_minute").notNull(),
    id: text("id").primaryKey(),
    lecturerId: text("lecturer_id")
      .notNull()
      .references(() => lecturers.id, { onDelete: "cascade" }),
    startMinute: integer("start_minute").notNull(),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("lecturer_availabilities_window_uq").on(
      table.academicPeriodId,
      table.lecturerId,
      table.dayOfWeek,
      table.startMinute,
      table.endMinute
    ),
    check(
      "lecturer_availabilities_day_ck",
      sql`${table.dayOfWeek} >= 1 AND ${table.dayOfWeek} <= 7`
    ),
    check(
      "lecturer_availabilities_time_ck",
      sql`${table.startMinute} >= 0 AND ${table.endMinute} <= 1440 AND ${table.endMinute} > ${table.startMinute}`
    ),
  ]
);

export const scheduleDrafts = sqliteTable(
  "schedule_drafts",
  {
    academicPeriodId: text("academic_period_id")
      .notNull()
      .references(() => academicPeriods.id, { onDelete: "restrict" }),
    approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
    approvedBy: text("approved_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    id: text("id").primaryKey(),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    publishedBy: text("published_by").references(() => user.id, {
      onDelete: "set null",
    }),
    rejectionReason: text("rejection_reason"),
    status: text("status").default("DRAFT").notNull(),
    studyProgramId: text("study_program_id")
      .notNull()
      .references(() => studyPrograms.id, { onDelete: "restrict" }),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
    submittedBy: text("submitted_by").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at"),
    version: integer("version").default(0).notNull(),
  },
  (table) => [
    index("schedule_drafts_program_period_status_idx").on(
      table.studyProgramId,
      table.academicPeriodId,
      table.status
    ),
  ]
);

export const scheduleSlots = sqliteTable(
  "schedule_slots",
  {
    classSectionId: text("class_section_id")
      .notNull()
      .references(() => classSections.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
    endAt: integer("end_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    instructions: text("instructions"),
    modality: text("modality").default("OFFLINE").notNull(),
    onlineUrl: text("online_url"),
    roomId: text("room_id").references(() => rooms.id, {
      onDelete: "restrict",
    }),
    scheduleDraftId: text("schedule_draft_id")
      .notNull()
      .references(() => scheduleDrafts.id, { onDelete: "cascade" }),
    startAt: integer("start_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("schedule_slots_draft_class_uq").on(
      table.scheduleDraftId,
      table.classSectionId
    ),
    index("schedule_slots_room_window_idx").on(
      table.roomId,
      table.startAt,
      table.endAt
    ),
    check(
      "schedule_slots_time_order_ck",
      sql`${table.endAt} > ${table.startAt}`
    ),
  ]
);

export const examSchedules = sqliteTable(
  "exam_schedules",
  {
    classSectionId: text("class_section_id")
      .notNull()
      .references(() => classSections.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
    endAt: integer("end_at", { mode: "timestamp_ms" }).notNull(),
    examType: text("exam_type").notNull(),
    id: text("id").primaryKey(),
    roomId: text("room_id").references(() => rooms.id, {
      onDelete: "restrict",
    }),
    scheduleDraftId: text("schedule_draft_id")
      .notNull()
      .references(() => scheduleDrafts.id, { onDelete: "cascade" }),
    startAt: integer("start_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("exam_schedules_draft_class_type_uq").on(
      table.scheduleDraftId,
      table.classSectionId,
      table.examType
    ),
    index("exam_schedules_room_window_idx").on(
      table.roomId,
      table.startAt,
      table.endAt
    ),
    check(
      "exam_schedules_time_order_ck",
      sql`${table.endAt} > ${table.startAt}`
    ),
  ]
);

export const scheduleConflicts = sqliteTable(
  "schedule_conflicts",
  {
    classSectionId: text("class_section_id").references(
      () => classSections.id,
      {
        onDelete: "cascade",
      }
    ),
    conflictType: text("conflict_type").notNull(),
    createdAt: timestamp("created_at"),
    endAt: integer("end_at", { mode: "timestamp_ms" }),
    entityIds: text("entity_ids").notNull(),
    id: text("id").primaryKey(),
    message: text("message").notNull(),
    resolution: text("resolution"),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
    resolvedBy: text("resolved_by").references(() => user.id, {
      onDelete: "set null",
    }),
    scheduleDraftId: text("schedule_draft_id")
      .notNull()
      .references(() => scheduleDrafts.id, { onDelete: "cascade" }),
    severity: text("severity").default("BLOCKING").notNull(),
    startAt: integer("start_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("schedule_conflicts_draft_severity_resolved_idx").on(
      table.scheduleDraftId,
      table.severity,
      table.resolvedAt
    ),
  ]
);

export const scheduleApprovals = sqliteTable(
  "schedule_approvals",
  {
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at"),
    decision: text("decision").notNull(),
    draftVersion: integer("draft_version").notNull(),
    id: text("id").primaryKey(),
    reason: text("reason"),
    scheduleDraftId: text("schedule_draft_id")
      .notNull()
      .references(() => scheduleDrafts.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("schedule_approvals_draft_created_at_idx").on(
      table.scheduleDraftId,
      table.createdAt
    ),
  ]
);

export const classMeetings = sqliteTable(
  "class_meetings",
  {
    classSectionId: text("class_section_id")
      .notNull()
      .references(() => classSections.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
    endAt: integer("end_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    instructions: text("instructions"),
    modality: text("modality").default("OFFLINE").notNull(),
    onlineUrl: text("online_url"),
    roomId: text("room_id").references(() => rooms.id, {
      onDelete: "restrict",
    }),
    sequence: integer("sequence").notNull(),
    startAt: integer("start_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: timestamp("updated_at"),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    uniqueIndex("class_meetings_class_sequence_uq").on(
      table.classSectionId,
      table.sequence
    ),
    index("class_meetings_window_idx").on(table.startAt, table.endAt),
    check("class_meetings_sequence_positive_ck", sql`${table.sequence} > 0`),
    check(
      "class_meetings_time_order_ck",
      sql`${table.endAt} > ${table.startAt}`
    ),
  ]
);

export const scheduleChangeRequests = sqliteTable(
  "schedule_change_requests",
  {
    createdAt: timestamp("created_at"),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
    decidedBy: text("decided_by").references(() => user.id, {
      onDelete: "set null",
    }),
    decisionReason: text("decision_reason"),
    id: text("id").primaryKey(),
    meetingId: text("meeting_id")
      .notNull()
      .references(() => classMeetings.id, { onDelete: "cascade" }),
    proposedEndAt: integer("proposed_end_at", {
      mode: "timestamp_ms",
    }).notNull(),
    proposedRoomId: text("proposed_room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "restrict" }),
    proposedStartAt: integer("proposed_start_at", {
      mode: "timestamp_ms",
    }).notNull(),
    reason: text("reason").notNull(),
    requestedBy: text("requested_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    status: text("status").default("PENDING").notNull(),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    index("schedule_change_requests_status_created_idx").on(
      table.status,
      table.createdAt
    ),
    check(
      "schedule_change_requests_time_order_ck",
      sql`${table.proposedEndAt} > ${table.proposedStartAt}`
    ),
  ]
);

export const scheduleRevisions = sqliteTable(
  "schedule_revisions",
  {
    changeRequestId: text("change_request_id").references(
      () => scheduleChangeRequests.id,
      { onDelete: "set null" }
    ),
    changedBy: text("changed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at"),
    effectiveFrom: integer("effective_from", {
      mode: "timestamp_ms",
    }).notNull(),
    effectiveUntil: integer("effective_until", { mode: "timestamp_ms" }),
    endAt: integer("end_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    instructions: text("instructions"),
    meetingId: text("meeting_id")
      .notNull()
      .references(() => classMeetings.id, { onDelete: "cascade" }),
    modality: text("modality").notNull(),
    onlineUrl: text("online_url"),
    reason: text("reason").notNull(),
    roomId: text("room_id").references(() => rooms.id, {
      onDelete: "restrict",
    }),
    startAt: integer("start_at", { mode: "timestamp_ms" }).notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    uniqueIndex("schedule_revisions_meeting_version_uq").on(
      table.meetingId,
      table.version
    ),
    index("schedule_revisions_meeting_effective_idx").on(
      table.meetingId,
      table.effectiveFrom,
      table.effectiveUntil
    ),
  ]
);
