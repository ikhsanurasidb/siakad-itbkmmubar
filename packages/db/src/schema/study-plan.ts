import { user } from "@db/schema/auth";
import { curricula, curriculumCourses } from "@db/schema/curriculum";
import { academicPeriods, courses, students } from "@db/schema/master-data";
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

export const studyPlanModes = ["PACKAGE", "FREE"] as const;
export const studyPlanStatuses = ["DRAFT", "FINAL"] as const;
export const studyPlanHistoryActions = [
  "GENERATE",
  "FINALIZE",
  "REOPEN",
] as const;

export const studyPlans = sqliteTable(
  "study_plans",
  {
    academicPeriodId: text("academic_period_id")
      .notNull()
      .references(() => academicPeriods.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at"),
    curriculumId: text("curriculum_id").references(() => curricula.id, {
      onDelete: "restrict",
    }),
    finalizedAt: integer("finalized_at", { mode: "timestamp_ms" }),
    finalizedBy: text("finalized_by").references(() => user.id, {
      onDelete: "set null",
    }),
    id: text("id").primaryKey(),
    mode: text("mode").default("PACKAGE").notNull(),
    status: text("status").default("DRAFT").notNull(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    totalCourses: integer("total_courses").default(0).notNull(),
    totalCredits: integer("total_credits").default(0).notNull(),
    updatedAt: timestamp("updated_at"),
    version: integer("version").default(0).notNull(),
  },
  (table) => [
    uniqueIndex("study_plans_student_period_uq").on(
      table.studentId,
      table.academicPeriodId
    ),
    index("study_plans_period_status_idx").on(
      table.academicPeriodId,
      table.status
    ),
    index("study_plans_student_updated_at_idx").on(
      table.studentId,
      table.updatedAt
    ),
    check(
      "study_plans_total_credits_non_negative_ck",
      sql`${table.totalCredits} >= 0`
    ),
  ]
);

export const studyPlanItems = sqliteTable(
  "study_plan_items",
  {
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at"),
    credits: integer("credits").notNull(),
    curriculumCourseId: text("curriculum_course_id").references(
      () => curriculumCourses.id,
      { onDelete: "set null" }
    ),
    id: text("id").primaryKey(),
    semester: integer("semester").notNull(),
    sortOrder: integer("sort_order").notNull(),
    source: text("source").default("PACKAGE").notNull(),
    studyPlanId: text("study_plan_id")
      .notNull()
      .references(() => studyPlans.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("study_plan_items_plan_course_uq").on(
      table.studyPlanId,
      table.courseId
    ),
    index("study_plan_items_plan_semester_idx").on(
      table.studyPlanId,
      table.semester,
      table.sortOrder
    ),
    check(
      "study_plan_items_semester_range_ck",
      sql`${table.semester} >= 1 AND ${table.semester} <= 8`
    ),
    check(
      "study_plan_items_credits_positive_ck",
      sql`${table.credits} >= 1 AND ${table.credits} <= 6`
    ),
  ]
);

export const studyPlanHistories = sqliteTable(
  "study_plan_histories",
  {
    action: text("action").notNull(),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at"),
    fromStatus: text("from_status"),
    id: text("id").primaryKey(),
    metadata: text("metadata"),
    reason: text("reason"),
    studyPlanId: text("study_plan_id")
      .notNull()
      .references(() => studyPlans.id, { onDelete: "cascade" }),
    toStatus: text("to_status"),
  },
  (table) => [
    index("study_plan_histories_plan_created_at_idx").on(
      table.studyPlanId,
      table.createdAt
    ),
  ]
);

export const studyPlanGenerationJobs = sqliteTable(
  "study_plan_generation_jobs",
  {
    academicPeriodId: text("academic_period_id")
      .notNull()
      .references(() => academicPeriods.id, { onDelete: "restrict" }),
    checkpointStudentId: text("checkpoint_student_id"),
    completedCount: integer("completed_count").default(0).notNull(),
    createdAt: timestamp("created_at"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    errorCount: integer("error_count").default(0).notNull(),
    failureDetails: text("failure_details"),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key"),
    mode: text("mode").default("PACKAGE").notNull(),
    processedCount: integer("processed_count").default(0).notNull(),
    status: text("status").default("PENDING").notNull(),
    totalCount: integer("total_count").default(0).notNull(),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("study_plan_generation_jobs_period_key_uq").on(
      table.academicPeriodId,
      table.idempotencyKey
    ),
    index("study_plan_generation_jobs_period_created_idx").on(
      table.academicPeriodId,
      table.createdAt
    ),
    index("study_plan_generation_jobs_status_idx").on(table.status),
  ]
);
