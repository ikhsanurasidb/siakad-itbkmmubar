import { user } from "@db/schema/auth";
import { courses, academicPeriods, students } from "@db/schema/master-data";
import { classSections } from "@db/schema/scheduling";
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

export const gradeStatuses = [
  "DRAFT",
  "SUBMITTED",
  "LOCKED",
  "PUBLISHED",
] as const;

export const classGradeComponents = sqliteTable(
  "class_grade_components",
  {
    classSectionId: text("class_section_id")
      .notNull()
      .references(() => classSections.id, { onDelete: "cascade" }),
    componentCode: text("component_code").notNull(),
    createdAt: timestamp("created_at"),
    id: text("id").primaryKey(),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull(),
    weight: integer("weight").notNull(),
  },
  (table) => [
    uniqueIndex("class_grade_components_class_code_uq").on(
      table.classSectionId,
      table.componentCode
    ),
    index("class_grade_components_class_idx").on(table.classSectionId),
    check(
      "class_grade_components_weight_ck",
      sql`${table.weight} >= 0 AND ${table.weight} <= 100`
    ),
  ]
);

export const studentComponentScores = sqliteTable(
  "student_component_scores",
  {
    classGradeComponentId: text("class_grade_component_id")
      .notNull()
      .references(() => classGradeComponents.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
    id: text("id").primaryKey(),
    scoreHundredths: integer("score_hundredths").notNull(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    updatedAt: timestamp("updated_at"),
    version: integer("version").default(0).notNull(),
  },
  (table) => [
    uniqueIndex("student_component_scores_student_component_uq").on(
      table.studentId,
      table.classGradeComponentId
    ),
    index("student_component_scores_component_idx").on(
      table.classGradeComponentId
    ),
    check(
      "student_component_scores_range_ck",
      sql`${table.scoreHundredths} >= 0 AND ${table.scoreHundredths} <= 10000`
    ),
  ]
);

export const gradeSubmissionBatches = sqliteTable(
  "grade_submission_batches",
  {
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    classSectionId: text("class_section_id")
      .notNull()
      .references(() => classSections.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
    id: text("id").primaryKey(),
    status: text("status").default("DRAFT").notNull(),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
    version: integer("version").default(0).notNull(),
  },
  (table) => [
    index("grade_submission_batches_class_status_idx").on(
      table.classSectionId,
      table.status
    ),
  ]
);

export const finalGradeSnapshots = sqliteTable(
  "final_grade_snapshots",
  {
    attempt: integer("attempt").default(1).notNull(),
    classSectionId: text("class_section_id")
      .notNull()
      .references(() => classSections.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at"),
    gradeCode: text("grade_code").notNull(),
    gradePoint: integer("grade_point_hundredths").notNull(),
    id: text("id").primaryKey(),
    policyVersion: text("policy_version").notNull(),
    rawScoreHundredths: integer("raw_score_hundredths").notNull(),
    roundedScoreHundredths: integer("rounded_score_hundredths").notNull(),
    scaleVersionId: text("scale_version_id"),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    takenAt: timestamp("taken_at"),
  },
  (table) => [
    uniqueIndex("final_grade_snapshots_class_student_attempt_uq").on(
      table.classSectionId,
      table.studentId,
      table.attempt
    ),
    index("final_grade_snapshots_student_taken_idx").on(
      table.studentId,
      table.takenAt
    ),
    check(
      "final_grade_snapshots_score_ck",
      sql`${table.roundedScoreHundredths} >= 0 AND ${table.roundedScoreHundredths} <= 10000`
    ),
  ]
);

export const gradePublications = sqliteTable(
  "grade_publications",
  {
    academicPeriodId: text("academic_period_id")
      .notNull()
      .references(() => academicPeriods.id, { onDelete: "restrict" }),
    classSectionId: text("class_section_id")
      .notNull()
      .references(() => classSections.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at"),
    id: text("id").primaryKey(),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    publishedBy: text("published_by").references(() => user.id, {
      onDelete: "set null",
    }),
    status: text("status").default("PENDING").notNull(),
    version: integer("version").default(0).notNull(),
  },
  (table) => [
    uniqueIndex("grade_publications_class_period_uq").on(
      table.classSectionId,
      table.academicPeriodId
    ),
    index("grade_publications_period_status_idx").on(
      table.academicPeriodId,
      table.status
    ),
  ]
);

export const studyResultSnapshots = sqliteTable(
  "study_result_snapshots",
  {
    academicPeriodId: text("academic_period_id")
      .notNull()
      .references(() => academicPeriods.id, { onDelete: "restrict" }),
    builtAt: timestamp("built_at"),
    countedCredits: integer("counted_credits").notNull(),
    countedQualityPointsHundredths: integer(
      "counted_quality_points_hundredths"
    ).notNull(),
    id: text("id").primaryKey(),
    ipkHundredths: integer("ipk_hundredths").notNull(),
    ipsHundredths: integer("ips_hundredths").notNull(),
    policyVersion: text("policy_version").notNull(),
    retakePolicy: text("retake_policy").notNull(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("study_result_snapshots_student_period_uq").on(
      table.studentId,
      table.academicPeriodId
    ),
    index("study_result_snapshots_student_idx").on(
      table.studentId,
      table.builtAt
    ),
  ]
);

export const transcriptEntries = sqliteTable(
  "transcript_entries",
  {
    academicPeriodId: text("academic_period_id")
      .notNull()
      .references(() => academicPeriods.id, { onDelete: "restrict" }),
    attempt: integer("attempt").notNull(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    credits: integer("credits").notNull(),
    finalGradeSnapshotId: text("final_grade_snapshot_id")
      .notNull()
      .references(() => finalGradeSnapshots.id, { onDelete: "restrict" }),
    gradeCode: text("grade_code").notNull(),
    gradePointHundredths: integer("grade_point_hundredths").notNull(),
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    studyResultSnapshotId: text("study_result_snapshot_id")
      .notNull()
      .references(() => studyResultSnapshots.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("transcript_entries_result_course_uq").on(
      table.studyResultSnapshotId,
      table.courseId
    ),
    index("transcript_entries_student_period_idx").on(
      table.studentId,
      table.academicPeriodId
    ),
  ]
);

export const gradeAdjustments = sqliteTable(
  "grade_adjustments",
  {
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at"),
    finalGradeSnapshotId: text("final_grade_snapshot_id").references(
      () => finalGradeSnapshots.id,
      { onDelete: "restrict" }
    ),
    id: text("id").primaryKey(),
    newValue: text("new_value").notNull(),
    oldValue: text("old_value"),
    reason: text("reason").notNull(),
  },
  (table) => [
    index("grade_adjustments_snapshot_created_idx").on(
      table.finalGradeSnapshotId,
      table.createdAt
    ),
  ]
);
