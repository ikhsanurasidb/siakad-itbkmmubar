import { academicPeriods, students } from "@db/schema/master-data";
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

export const studentSemesterTrackerSources = ["AUTO", "MANUAL"] as const;

export const studentSemesterTrackers = sqliteTable(
  "student_semester_trackers",
  {
    academicPeriodId: text("academic_period_id")
      .notNull()
      .references(() => academicPeriods.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at"),
    id: text("id").primaryKey(),
    semesterNumber: integer("semester_number").notNull(),
    source: text("source").default("AUTO").notNull(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("student_semester_trackers_student_period_uq").on(
      table.studentId,
      table.academicPeriodId
    ),
    index("student_semester_trackers_period_semester_idx").on(
      table.academicPeriodId,
      table.semesterNumber
    ),
    check(
      "student_semester_trackers_semester_range_ck",
      sql`${table.semesterNumber} >= 1 AND ${table.semesterNumber} <= 8`
    ),
  ]
);
