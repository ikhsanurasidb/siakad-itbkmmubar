import { user } from "@db/schema/auth";
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

export const masterDataStatuses = ["ACTIVE", "ARCHIVED"] as const;
export const academicStatuses = [
  "ACTIVE",
  "LEAVE",
  "GRADUATED",
  "DROPPED_OUT",
] as const;
export const masterProvisioningStatuses = [
  "NOT_REQUIRED",
  "PENDING_PROVISIONING",
  "PROVISIONED",
  "FAILED",
] as const;
export const academicPeriodTerms = ["ODD", "EVEN", "SHORT"] as const;
export const academicPeriodStatuses = ["DRAFT", "ACTIVE", "CLOSED"] as const;
export const importEntityTypes = [
  "STUDY_PROGRAM",
  "COHORT",
  "STUDENT",
  "LECTURER",
  "ROOM",
  "COURSE",
  "ACADEMIC_YEAR",
  "ACADEMIC_PERIOD",
] as const;
export const importStatuses = [
  "UPLOADED",
  "VALIDATING",
  "READY",
  "COMMITTING",
  "COMPLETED",
  "PARTIAL_FAILED",
  "FAILED",
] as const;
export const importRowStatuses = ["VALID", "WARNING", "INVALID"] as const;
export const importRowCommitStatuses = [
  "PENDING",
  "COMMITTED",
  "FAILED",
] as const;
export const identifierTypes = ["NIM", "DSN", "NIDN", "NUPTK"] as const;
export const studyProgramDegrees = ["S1", "S2", "S3"] as const;

export const studyPrograms = sqliteTable(
  "study_programs",
  {
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    code: text("code").notNull(),
    createdAt: timestamp("created_at"),
    degree: text("degree").notNull(),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    status: text("status").default("ACTIVE").notNull(),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("study_programs_code_uq").on(table.code),
    index("study_programs_status_name_idx").on(table.status, table.name),
  ]
);

export const cohorts = sqliteTable(
  "cohorts",
  {
    createdAt: timestamp("created_at"),
    entryYear: integer("entry_year").notNull(),
    id: text("id").primaryKey(),
    status: text("status").default("ACTIVE").notNull(),
    studyProgramId: text("study_program_id")
      .notNull()
      .references(() => studyPrograms.id, { onDelete: "restrict" }),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("cohorts_program_year_uq").on(
      table.studyProgramId,
      table.entryYear
    ),
    index("cohorts_status_year_idx").on(table.status, table.entryYear),
  ]
);

export const students = sqliteTable(
  "students",
  {
    academicStatus: text("academic_status").default("ACTIVE").notNull(),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    cohortId: text("cohort_id")
      .notNull()
      .references(() => cohorts.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at"),
    email: text("email"),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    nim: text("nim").notNull(),
    phone: text("phone"),
    provisioningStatus: text("provisioning_status")
      .default("PENDING_PROVISIONING")
      .notNull(),
    status: text("status").default("ACTIVE").notNull(),
    studyProgramId: text("study_program_id")
      .notNull()
      .references(() => studyPrograms.id, { onDelete: "restrict" }),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("students_nim_uq").on(table.nim),
    index("students_program_cohort_status_idx").on(
      table.studyProgramId,
      table.cohortId,
      table.status
    ),
    index("students_name_idx").on(table.name),
  ]
);

export const lecturers = sqliteTable(
  "lecturers",
  {
    academicStatus: text("academic_status").default("ACTIVE").notNull(),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    createdAt: timestamp("created_at"),
    dsn: text("dsn"),
    email: text("email"),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    nidn: text("nidn"),
    nuptk: text("nuptk"),
    phone: text("phone"),
    provisioningStatus: text("provisioning_status")
      .default("PENDING_PROVISIONING")
      .notNull(),
    status: text("status").default("ACTIVE").notNull(),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("lecturers_dsn_uq").on(table.dsn),
    uniqueIndex("lecturers_nidn_uq").on(table.nidn),
    uniqueIndex("lecturers_nuptk_uq").on(table.nuptk),
    index("lecturers_status_name_idx").on(table.status, table.name),
  ]
);

export const rooms = sqliteTable(
  "rooms",
  {
    capacity: integer("capacity").notNull(),
    code: text("code").notNull(),
    createdAt: timestamp("created_at"),
    id: text("id").primaryKey(),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    name: text("name").notNull(),
    status: text("status").default("ACTIVE").notNull(),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("rooms_code_uq").on(table.code),
    index("rooms_status_name_idx").on(table.status, table.name),
    check("rooms_capacity_positive_ck", sql`${table.capacity} > 0`),
    check(
      "rooms_latitude_range_ck",
      sql`${table.latitude} >= -90 AND ${table.latitude} <= 90`
    ),
    check(
      "rooms_longitude_range_ck",
      sql`${table.longitude} >= -180 AND ${table.longitude} <= 180`
    ),
  ]
);

export const courses = sqliteTable(
  "courses",
  {
    code: text("code").notNull(),
    createdAt: timestamp("created_at"),
    credits: integer("credits").notNull(),
    defaultSemester: integer("default_semester").notNull(),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    status: text("status").default("ACTIVE").notNull(),
    studyProgramId: text("study_program_id")
      .notNull()
      .references(() => studyPrograms.id, { onDelete: "restrict" }),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("courses_code_uq").on(table.code),
    index("courses_program_status_idx").on(table.studyProgramId, table.status),
    check(
      "courses_credits_range_ck",
      sql`${table.credits} >= 1 AND ${table.credits} <= 6`
    ),
    check(
      "courses_semester_range_ck",
      sql`${table.defaultSemester} >= 1 AND ${table.defaultSemester} <= 14`
    ),
  ]
);

export const academicYears = sqliteTable(
  "academic_years",
  {
    code: text("code").notNull(),
    createdAt: timestamp("created_at"),
    endYear: integer("end_year").notNull(),
    id: text("id").primaryKey(),
    startYear: integer("start_year").notNull(),
    status: text("status").default("ACTIVE").notNull(),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("academic_years_code_uq").on(table.code),
    index("academic_years_status_start_year_idx").on(
      table.status,
      table.startYear
    ),
    check(
      "academic_years_order_ck",
      sql`${table.endYear} = ${table.startYear} + 1`
    ),
  ]
);

export const academicPeriods = sqliteTable(
  "academic_periods",
  {
    academicYearId: text("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at"),
    endDate: integer("end_date", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    startDate: integer("start_date", { mode: "timestamp_ms" }).notNull(),
    status: text("status").default("DRAFT").notNull(),
    term: text("term").notNull(),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("academic_periods_year_term_uq").on(
      table.academicYearId,
      table.term
    ),
    index("academic_periods_status_date_idx").on(table.status, table.startDate),
    check(
      "academic_periods_date_order_ck",
      sql`${table.endDate} >= ${table.startDate}`
    ),
  ]
);

export const importJobs = sqliteTable(
  "import_jobs",
  {
    checkpointRow: integer("checkpoint_row").default(0).notNull(),
    checksum: text("checksum").notNull(),
    committedAt: integer("committed_at", { mode: "timestamp_ms" }),
    createdAt: timestamp("created_at"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    entityType: text("entity_type").notNull(),
    errorCount: integer("error_count").default(0).notNull(),
    fileObjectId: text("file_object_id"),
    filename: text("filename").notNull(),
    id: text("id").primaryKey(),
    invalidCount: integer("invalid_count").default(0).notNull(),
    processedRows: integer("processed_rows").default(0).notNull(),
    status: text("status").default("UPLOADED").notNull(),
    templateVersion: text("template_version").notNull(),
    totalRows: integer("total_rows").default(0).notNull(),
    validCount: integer("valid_count").default(0).notNull(),
    warningCount: integer("warning_count").default(0).notNull(),
  },
  (table) => [
    uniqueIndex("import_jobs_checksum_entity_uq").on(
      table.checksum,
      table.entityType
    ),
    index("import_jobs_created_by_created_at_idx").on(
      table.createdBy,
      table.createdAt
    ),
    index("import_jobs_status_idx").on(table.status),
  ]
);

export const importRows = sqliteTable(
  "import_rows",
  {
    commitError: text("commit_error"),
    commitStatus: text("commit_status").default("PENDING").notNull(),
    createdAt: timestamp("created_at"),
    entityId: text("entity_id"),
    errors: text("errors"),
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => importJobs.id, { onDelete: "cascade" }),
    normalizedData: text("normalized_data"),
    rawData: text("raw_data").notNull(),
    rowNumber: integer("row_number").notNull(),
    status: text("status").notNull(),
  },
  (table) => [
    uniqueIndex("import_rows_job_row_uq").on(table.jobId, table.rowNumber),
    index("import_rows_job_status_idx").on(table.jobId, table.status),
  ]
);

export const identifierUsages = sqliteTable(
  "identifier_usages",
  {
    createdAt: timestamp("created_at"),
    entityId: text("entity_id").notNull(),
    entityType: text("entity_type").notNull(),
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    identifierType: text("identifier_type").notNull(),
    lockedAt: integer("locked_at", { mode: "timestamp_ms" }),
    usageType: text("usage_type").notNull(),
  },
  (table) => [
    uniqueIndex("identifier_usages_identifier_uq").on(
      table.identifierType,
      table.identifier
    ),
    index("identifier_usages_entity_idx").on(table.entityType, table.entityId),
    index("identifier_usages_locked_idx").on(
      table.identifierType,
      table.lockedAt
    ),
  ]
);
