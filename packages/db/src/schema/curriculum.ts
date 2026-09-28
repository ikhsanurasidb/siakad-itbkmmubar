import { user } from "@db/schema/auth";
import { courses, cohorts, studyPrograms } from "@db/schema/master-data";
import { fileObjects } from "@db/schema/platform";
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

export const curriculumStatuses = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export const curriculumCourseTypes = ["REQUIRED", "ELECTIVE"] as const;

export const curricula = sqliteTable(
  "curricula",
  {
    activatedAt: integer("activated_at", { mode: "timestamp_ms" }),
    activatedBy: text("activated_by").references(() => user.id, {
      onDelete: "set null",
    }),
    cohortId: text("cohort_id")
      .notNull()
      .references(() => cohorts.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    status: text("status").default("DRAFT").notNull(),
    studyProgramId: text("study_program_id")
      .notNull()
      .references(() => studyPrograms.id, { onDelete: "restrict" }),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    index("curricula_program_cohort_status_idx").on(
      table.studyProgramId,
      table.cohortId,
      table.status
    ),
    index("curricula_status_updated_at_idx").on(table.status, table.updatedAt),
  ]
);

export const curriculumDocuments = sqliteTable(
  "curriculum_documents",
  {
    createdAt: timestamp("created_at"),
    curriculumId: text("curriculum_id")
      .notNull()
      .references(() => curricula.id, { onDelete: "cascade" }),
    documentType: text("document_type").default("CURRICULUM").notNull(),
    fileObjectId: text("file_object_id")
      .notNull()
      .references(() => fileObjects.id, { onDelete: "restrict" }),
    id: text("id").primaryKey(),
    isCurrent: integer("is_current", { mode: "boolean" })
      .default(true)
      .notNull(),
  },
  (table) => [
    index("curriculum_documents_curriculum_current_idx").on(
      table.curriculumId,
      table.isCurrent
    ),
    index("curriculum_documents_file_idx").on(table.fileObjectId),
  ]
);

export const curriculumCourses = sqliteTable(
  "curriculum_courses",
  {
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    courseType: text("course_type").default("REQUIRED").notNull(),
    createdAt: timestamp("created_at"),
    credits: integer("credits").notNull(),
    curriculumId: text("curriculum_id")
      .notNull()
      .references(() => curricula.id, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
    semester: integer("semester").notNull(),
    sortOrder: integer("sort_order").notNull(),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("curriculum_courses_curriculum_course_semester_uq").on(
      table.curriculumId,
      table.courseId,
      table.semester
    ),
    index("curriculum_courses_curriculum_semester_idx").on(
      table.curriculumId,
      table.semester,
      table.sortOrder
    ),
    check(
      "curriculum_courses_semester_range_ck",
      sql`${table.semester} >= 1 AND ${table.semester} <= 8`
    ),
    check(
      "curriculum_courses_credits_positive_ck",
      sql`${table.credits} >= 1 AND ${table.credits} <= 6`
    ),
  ]
);

export const courseAssessmentDefaults = sqliteTable(
  "course_assessment_defaults",
  {
    componentCode: text("component_code").notNull(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
    id: text("id").primaryKey(),
    label: text("label").notNull(),
    updatedAt: timestamp("updated_at"),
    weight: integer("weight").notNull(),
  },
  (table) => [
    uniqueIndex("course_assessment_defaults_course_component_uq").on(
      table.courseId,
      table.componentCode
    ),
    index("course_assessment_defaults_course_idx").on(table.courseId),
    check(
      "course_assessment_defaults_weight_range_ck",
      sql`${table.weight} >= 0 AND ${table.weight} <= 100`
    ),
  ]
);

export const curriculumAssessmentOverrides = sqliteTable(
  "curriculum_assessment_overrides",
  {
    componentCode: text("component_code").notNull(),
    createdAt: timestamp("created_at"),
    curriculumCourseId: text("curriculum_course_id")
      .notNull()
      .references(() => curriculumCourses.id, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
    label: text("label").notNull(),
    updatedAt: timestamp("updated_at"),
    weight: integer("weight").notNull(),
  },
  (table) => [
    uniqueIndex("curriculum_assessment_overrides_course_component_uq").on(
      table.curriculumCourseId,
      table.componentCode
    ),
    index("curriculum_assessment_overrides_course_idx").on(
      table.curriculumCourseId
    ),
    check(
      "curriculum_assessment_overrides_weight_range_ck",
      sql`${table.weight} >= 0 AND ${table.weight} <= 100`
    ),
  ]
);
