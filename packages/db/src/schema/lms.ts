import { user } from "@db/schema/auth";
import { students } from "@db/schema/master-data";
import { fileObjects } from "@db/schema/platform";
import { classMeetings, classSections } from "@db/schema/scheduling";
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

export const learningContentStatuses = ["DRAFT", "PUBLISHED"] as const;
export const assignmentSubmissionStatuses = ["SUBMITTED", "LATE"] as const;
export const forumThreadStatuses = ["OPEN", "CLOSED"] as const;

export const learningMaterials = sqliteTable(
  "learning_materials",
  {
    body: text("body"),
    classMeetingId: text("class_meeting_id").references(
      () => classMeetings.id,
      {
        onDelete: "cascade",
      }
    ),
    classSectionId: text("class_section_id")
      .notNull()
      .references(() => classSections.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    id: text("id").primaryKey(),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    publishedBy: text("published_by").references(() => user.id, {
      onDelete: "set null",
    }),
    status: text("status").default("DRAFT").notNull(),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at"),
    version: integer("version").default(0).notNull(),
  },
  (table) => [
    index("learning_materials_section_meeting_status_idx").on(
      table.classSectionId,
      table.classMeetingId,
      table.status
    ),
    check(
      "learning_materials_title_not_empty_ck",
      sql`length(trim(${table.title})) > 0`
    ),
  ]
);

export const materialFiles = sqliteTable(
  "material_files",
  {
    createdAt: timestamp("created_at"),
    fileObjectId: text("file_object_id")
      .notNull()
      .references(() => fileObjects.id, { onDelete: "restrict" }),
    id: text("id").primaryKey(),
    materialId: text("material_id")
      .notNull()
      .references(() => learningMaterials.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("material_files_material_file_uq").on(
      table.materialId,
      table.fileObjectId
    ),
    index("material_files_material_idx").on(table.materialId),
  ]
);

export const assignments = sqliteTable(
  "assignments",
  {
    allowResubmit: integer("allow_resubmit", { mode: "boolean" })
      .default(false)
      .notNull(),
    body: text("body"),
    classMeetingId: text("class_meeting_id").references(
      () => classMeetings.id,
      {
        onDelete: "cascade",
      }
    ),
    classSectionId: text("class_section_id")
      .notNull()
      .references(() => classSections.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    dueAt: integer("due_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    publishedBy: text("published_by").references(() => user.id, {
      onDelete: "set null",
    }),
    status: text("status").default("DRAFT").notNull(),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at"),
    version: integer("version").default(0).notNull(),
  },
  (table) => [
    index("assignments_section_meeting_status_due_idx").on(
      table.classSectionId,
      table.classMeetingId,
      table.status,
      table.dueAt
    ),
    check(
      "assignments_title_not_empty_ck",
      sql`length(trim(${table.title})) > 0`
    ),
  ]
);

export const assignmentFiles = sqliteTable(
  "assignment_files",
  {
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
    fileObjectId: text("file_object_id")
      .notNull()
      .references(() => fileObjects.id, { onDelete: "restrict" }),
    id: text("id").primaryKey(),
  },
  (table) => [
    uniqueIndex("assignment_files_assignment_file_uq").on(
      table.assignmentId,
      table.fileObjectId
    ),
    index("assignment_files_assignment_idx").on(table.assignmentId),
  ]
);

export const assignmentSubmissions = sqliteTable(
  "assignment_submissions",
  {
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    body: text("body"),
    createdAt: timestamp("created_at"),
    id: text("id").primaryKey(),
    isLate: integer("is_late", { mode: "boolean" }).notNull(),
    status: text("status").notNull(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    submittedAt: timestamp("submitted_at"),
    version: integer("version").notNull(),
  },
  (table) => [
    uniqueIndex("assignment_submissions_assignment_student_version_uq").on(
      table.assignmentId,
      table.studentId,
      table.version
    ),
    index("assignment_submissions_assignment_student_idx").on(
      table.assignmentId,
      table.studentId,
      table.submittedAt
    ),
  ]
);

export const submissionFiles = sqliteTable(
  "submission_files",
  {
    createdAt: timestamp("created_at"),
    fileObjectId: text("file_object_id")
      .notNull()
      .references(() => fileObjects.id, { onDelete: "restrict" }),
    id: text("id").primaryKey(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => assignmentSubmissions.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("submission_files_submission_file_uq").on(
      table.submissionId,
      table.fileObjectId
    ),
    index("submission_files_submission_idx").on(table.submissionId),
  ]
);

export const forumThreads = sqliteTable(
  "forum_threads",
  {
    classMeetingId: text("class_meeting_id").references(
      () => classMeetings.id,
      {
        onDelete: "cascade",
      }
    ),
    classSectionId: text("class_section_id")
      .notNull()
      .references(() => classSections.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    id: text("id").primaryKey(),
    status: text("status").default("OPEN").notNull(),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    index("forum_threads_section_meeting_status_idx").on(
      table.classSectionId,
      table.classMeetingId,
      table.status,
      table.createdAt
    ),
  ]
);

export const forumPosts = sqliteTable(
  "forum_posts",
  {
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at"),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    editedAt: integer("edited_at", { mode: "timestamp_ms" }),
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => forumThreads.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("forum_posts_thread_created_idx").on(table.threadId, table.createdAt),
  ]
);

export const forumAttachments = sqliteTable(
  "forum_attachments",
  {
    createdAt: timestamp("created_at"),
    fileObjectId: text("file_object_id")
      .notNull()
      .references(() => fileObjects.id, { onDelete: "restrict" }),
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => forumPosts.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("forum_attachments_post_file_uq").on(
      table.postId,
      table.fileObjectId
    ),
    index("forum_attachments_post_idx").on(table.postId),
  ]
);
