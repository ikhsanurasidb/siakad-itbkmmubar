import type {
  IdentityService,
  MasterDataService,
} from "@siakad-itbkmmubar/api/context";
import {
  academicPeriodStatusesList,
  MasterDataDomainError,
  assertAcademicPeriodStatusTransition,
  assertAcademicTerm,
  assertTemplateVersion,
  normalizeCode,
  normalizeIdentifierValue,
  normalizeOptional,
  normalizeStudyProgramDegree,
  normalizeText,
  parseAcademicPeriodDate,
  parseCoordinate,
  parseInteger,
  templateHeaders,
} from "@siakad-itbkmmubar/api/master-data";
import type {
  AcademicPeriodStatus,
  MasterDataEntityType,
} from "@siakad-itbkmmubar/api/master-data";
import type { Database } from "@siakad-itbkmmubar/db";
import {
  academicPeriods,
  academicYears,
  cohorts,
  courses,
  importJobs,
  importRows,
  lecturers,
  rooms,
  students,
  studyPrograms,
  identifierUsages,
} from "@siakad-itbkmmubar/db/schema/master-data";
import { auditLogs, outboxEvents } from "@siakad-itbkmmubar/db/schema/platform";
import { createUuidV7 } from "@siakad-itbkmmubar/uuid";
import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  like,
  or,
  sql,
} from "drizzle-orm";

type MasterDataRecord = Record<string, unknown>;

interface StatusCount {
  active: number | null;
  archived: number | null;
  total: number | null;
}

const IMPORT_ROW_BATCH_SIZE = 10;

const asRecord = (value: object): MasterDataRecord => ({ ...value });

const toRecords = async <T extends object>(
  query: PromiseLike<readonly T[]>
): Promise<MasterDataRecord[]> => {
  const values = await query;
  return values.map(asRecord);
};

const getReferenceIds = (
  records: readonly MasterDataRecord[],
  fieldId: string
): string[] => [
  ...new Set(
    records.flatMap((record) => {
      const value = record[fieldId];
      return typeof value === "string" && value ? [value] : [];
    })
  ),
];

const addStudyProgramNames = async (
  database: Database,
  records: readonly MasterDataRecord[]
): Promise<MasterDataRecord[]> => {
  const ids = getReferenceIds(records, "studyProgramId");
  if (ids.length === 0) {
    return [...records];
  }
  const references = await database
    .select({ id: studyPrograms.id, name: studyPrograms.name })
    .from(studyPrograms)
    .where(inArray(studyPrograms.id, ids));
  const names = new Map(
    references.map((reference) => [reference.id, reference.name])
  );
  return records.map((record) => ({
    ...record,
    studyProgramName: names.get(String(record.studyProgramId)) ?? null,
  }));
};

const addCohortEntryYears = async (
  database: Database,
  records: readonly MasterDataRecord[]
): Promise<MasterDataRecord[]> => {
  const ids = getReferenceIds(records, "cohortId");
  if (ids.length === 0) {
    return [...records];
  }
  const references = await database
    .select({ entryYear: cohorts.entryYear, id: cohorts.id })
    .from(cohorts)
    .where(inArray(cohorts.id, ids));
  const entryYears = new Map(
    references.map((reference) => [reference.id, reference.entryYear])
  );
  return records.map((record) => ({
    ...record,
    cohortEntryYear: entryYears.get(String(record.cohortId)) ?? null,
  }));
};

const addAcademicYearCodes = async (
  database: Database,
  records: readonly MasterDataRecord[]
): Promise<MasterDataRecord[]> => {
  const ids = getReferenceIds(records, "academicYearId");
  if (ids.length === 0) {
    return [...records];
  }
  const references = await database
    .select({
      code: academicYears.code,
      endYear: academicYears.endYear,
      id: academicYears.id,
      startYear: academicYears.startYear,
    })
    .from(academicYears)
    .where(inArray(academicYears.id, ids));
  const academicYearLabels = new Map(
    references.map((reference) => [
      reference.id,
      {
        code: reference.code,
        label: `${reference.startYear}/${reference.endYear}`,
      },
    ])
  );
  return records.map((record) => ({
    ...record,
    academicYearCode:
      academicYearLabels.get(String(record.academicYearId))?.code ?? null,
    academicYearLabel:
      academicYearLabels.get(String(record.academicYearId))?.label ?? null,
  }));
};

const enrichReferenceLabels = async (
  database: Database,
  entityType: MasterDataEntityType,
  records: readonly MasterDataRecord[]
): Promise<MasterDataRecord[]> => {
  switch (entityType) {
    case "ACADEMIC_PERIOD": {
      return addAcademicYearCodes(database, records);
    }
    case "COHORT":
    case "COURSE": {
      return addStudyProgramNames(database, records);
    }
    case "STUDENT": {
      const [withProgramNames, withCohortYears] = await Promise.all([
        addStudyProgramNames(database, records),
        addCohortEntryYears(database, records),
      ]);
      return withProgramNames.map((record, index) => ({
        ...record,
        cohortEntryYear: withCohortYears[index]?.cohortEntryYear ?? null,
      }));
    }
    default: {
      return [...records];
    }
  }
};

const normalizeCount = (value: number | null): number => value ?? 0;

const readStatusCount = async (
  query: PromiseLike<readonly StatusCount[]>
): Promise<{
  activeCount: number;
  archivedCount: number;
  totalCount: number;
}> => {
  const [row] = await query;
  return {
    activeCount: normalizeCount(row?.active ?? null),
    archivedCount: normalizeCount(row?.archived ?? null),
    totalCount: normalizeCount(row?.total ?? null),
  };
};

const ensureRecordAbsent = async (
  query: PromiseLike<readonly unknown[]>,
  message: string
): Promise<void> => {
  const values = await query;
  if (values.length > 0) {
    throw new MasterDataDomainError("DUPLICATE_DATABASE", message);
  }
};

const valueAsString = (
  data: Readonly<Record<string, unknown>>,
  key: string,
  required = true
): string => {
  const value = data[key];
  if (typeof value !== "string" || !normalizeText(value)) {
    if (!required) {
      return "";
    }
    throw new MasterDataDomainError("FIELD_REQUIRED", `${key} wajib diisi.`, {
      [key]: [`${key} wajib diisi.`],
    });
  }
  return normalizeText(value);
};

const optionalString = (
  data: Readonly<Record<string, unknown>>,
  key: string
): string | null => {
  const value = data[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new MasterDataDomainError("INVALID_FIELD", `${key} tidak valid.`);
  }
  return normalizeOptional(value);
};

const integerValue = (
  data: Readonly<Record<string, unknown>>,
  key: string
): number => {
  const value = data[key];
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return value;
  }
  return parseInteger(valueAsString(data, key), key);
};

const optionalIntegerValue = (
  data: Readonly<Record<string, unknown>>,
  key: string
): number | null => {
  const value = data[key];
  if (
    value === undefined ||
    value === null ||
    (typeof value === "string" && !normalizeText(value))
  ) {
    return null;
  }
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return value;
  }
  return parseInteger(valueAsString(data, key), key);
};

const coordinateValue = (
  data: Readonly<Record<string, unknown>>,
  key: "latitude" | "longitude"
): number => {
  const value = data[key];
  if (typeof value === "number") {
    return parseCoordinate(String(value), key);
  }
  return parseCoordinate(valueAsString(data, key), key);
};

const normalizeStatus = (
  value: unknown,
  fallback: "ACTIVE" | "ARCHIVED" = "ACTIVE"
): "ACTIVE" | "ARCHIVED" => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const normalized = normalizeText(String(value)).toUpperCase();
  if (normalized !== "ACTIVE" && normalized !== "ARCHIVED") {
    throw new MasterDataDomainError(
      "INVALID_STATUS",
      "Status harus ACTIVE atau ARCHIVED."
    );
  }
  return normalized;
};

const getCursorOffset = (cursor: string | undefined): number => {
  if (!cursor) {
    return 0;
  }
  const offset = Number(cursor);
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new MasterDataDomainError(
      "INVALID_CURSOR",
      "Cursor pagination tidak valid."
    );
  }
  return offset;
};

const createAudit = async (
  database: Database,
  actorUserId: string,
  action: "CREATE" | "UPDATE" | "ARCHIVE" | "REACTIVATE",
  entityType: MasterDataEntityType,
  entityId: string,
  beforeState: MasterDataRecord | null,
  afterState: MasterDataRecord | null
): Promise<void> => {
  await database.insert(auditLogs).values({
    action,
    actorUserId,
    afterState: afterState ? JSON.stringify(afterState) : null,
    beforeState: beforeState ? JSON.stringify(beforeState) : null,
    createdAt: new Date(),
    entityId,
    entityType,
    id: createUuidV7(),
    requestId: null,
  });
};

const assertVersionedUpdate = async (
  query: PromiseLike<readonly unknown[]>,
  entityType: MasterDataEntityType,
  entityId: string,
  expectedVersion: number
): Promise<void> => {
  const changedRows = await query;
  if (changedRows.length === 0) {
    throw new MasterDataDomainError(
      "MASTER_DATA_VERSION_CONFLICT",
      "Data master sudah berubah. Muat ulang detail sebelum menyimpan perubahan.",
      undefined,
      { entityId, entityType, expectedVersion }
    );
  }
};

const getRecordVersion = (record: MasterDataRecord): number => {
  const { version } = record;
  if (
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 1
  ) {
    throw new MasterDataDomainError(
      "INVALID_VERSION",
      "Versi data master tidak valid."
    );
  }
  return version;
};

const getActiveProgram = async (database: Database, id: string) => {
  const [program] = await database
    .select()
    .from(studyPrograms)
    .where(and(eq(studyPrograms.id, id), eq(studyPrograms.status, "ACTIVE")))
    .limit(1);
  if (!program) {
    throw new MasterDataDomainError(
      "REFERENCE_NOT_ACTIVE",
      "Prodi tidak ditemukan atau tidak aktif.",
      { studyProgramId: ["Pilih Prodi yang masih aktif."] }
    );
  }
  return program;
};

const getActiveAcademicYear = async (database: Database, id: string) => {
  const [academicYear] = await database
    .select()
    .from(academicYears)
    .where(and(eq(academicYears.id, id), eq(academicYears.status, "ACTIVE")))
    .limit(1);
  if (!academicYear) {
    throw new MasterDataDomainError(
      "REFERENCE_NOT_ACTIVE",
      "Tahun akademik tidak ditemukan atau tidak aktif.",
      { academicYearId: ["Pilih tahun akademik yang masih aktif."] }
    );
  }
  return academicYear;
};

const getActiveCohort = async (
  database: Database,
  id: string,
  studyProgramId?: string
) => {
  const [cohort] = await database
    .select()
    .from(cohorts)
    .where(and(eq(cohorts.id, id), eq(cohorts.status, "ACTIVE")))
    .limit(1);
  if (!cohort || (studyProgramId && cohort.studyProgramId !== studyProgramId)) {
    throw new MasterDataDomainError(
      "REFERENCE_NOT_ACTIVE",
      "Angkatan tidak ditemukan, tidak aktif, atau tidak sesuai dengan Prodi.",
      { cohortId: ["Pilih Angkatan aktif pada Prodi yang sama."] }
    );
  }
  return cohort;
};

const ensureIdentifierAvailable = async (
  database: Database,
  identifierType: "NIM" | "DSN" | "NIDN" | "NUPTK",
  identifier: string,
  entityId?: string
): Promise<void> => {
  const [usage] = await database
    .select({ entityId: identifierUsages.entityId })
    .from(identifierUsages)
    .where(
      and(
        eq(identifierUsages.identifierType, identifierType),
        eq(identifierUsages.identifier, identifier)
      )
    )
    .limit(1);
  if (usage && usage.entityId !== entityId) {
    throw new MasterDataDomainError(
      "DUPLICATE_IDENTIFIER",
      `${identifierType} sudah digunakan oleh data lain.`,
      { [identifierType.toLowerCase()]: [`${identifierType} sudah terdaftar.`] }
    );
  }
};

const replaceIdentifierUsages = async (
  database: Database,
  entityType: string,
  entityId: string,
  usages: readonly {
    identifier: string;
    identifierType: "NIM" | "DSN" | "NIDN" | "NUPTK";
  }[]
): Promise<void> => {
  await database
    .delete(identifierUsages)
    .where(
      and(
        eq(identifierUsages.entityType, entityType),
        eq(identifierUsages.entityId, entityId),
        isNull(identifierUsages.lockedAt)
      )
    );
  if (usages.length > 0) {
    await database.insert(identifierUsages).values(
      usages.map(({ identifier, identifierType }) => ({
        createdAt: new Date(),
        entityId,
        entityType,
        id: createUuidV7(),
        identifier,
        identifierType,
        lockedAt: null,
        usageType: "MASTER_DATA",
      }))
    );
  }
};

const emitProvisioningOutbox = async (
  database: Database,
  entityType: "STUDENT" | "LECTURER",
  entityId: string,
  identifier?: string
): Promise<void> => {
  const eventType =
    entityType === "STUDENT"
      ? "MASTER_STUDENT_REQUIRES_PROVISIONING"
      : "MASTER_LECTURER_REQUIRES_PROVISIONING";
  const [existing] = await database
    .select({ id: outboxEvents.id })
    .from(outboxEvents)
    .where(
      and(
        eq(outboxEvents.eventType, eventType),
        eq(outboxEvents.aggregateId, entityId)
      )
    )
    .limit(1);
  if (existing) {
    return;
  }
  await database.insert(outboxEvents).values({
    aggregateId: entityId,
    aggregateType: entityType,
    attempts: 0,
    availableAt: new Date(),
    createdAt: new Date(),
    eventType,
    id: createUuidV7(),
    payload: JSON.stringify({ entityId, identifier }),
    status: "PENDING",
  });
};

export const createMasterDataService = ({
  database,
  identityService,
  now = () => new Date(),
}: {
  database: Database;
  identityService?: Pick<IdentityService, "createAccount">;
  now?: () => Date;
}): MasterDataService => {
  // The entity switch is centralized so every master entity shares the same access contract.
  // eslint-disable-next-line complexity
  const get: MasterDataService["get"] = async ({ entityType, id }) => {
    let result: object | undefined;
    switch (entityType) {
      case "STUDY_PROGRAM": {
        [result] = await database
          .select()
          .from(studyPrograms)
          .where(eq(studyPrograms.id, id))
          .limit(1);
        break;
      }
      case "COHORT": {
        [result] = await database
          .select()
          .from(cohorts)
          .where(eq(cohorts.id, id))
          .limit(1);
        break;
      }
      case "STUDENT": {
        [result] = await database
          .select()
          .from(students)
          .where(eq(students.id, id))
          .limit(1);
        break;
      }
      case "LECTURER": {
        [result] = await database
          .select()
          .from(lecturers)
          .where(eq(lecturers.id, id))
          .limit(1);
        break;
      }
      case "ROOM": {
        [result] = await database
          .select()
          .from(rooms)
          .where(eq(rooms.id, id))
          .limit(1);
        break;
      }
      case "COURSE": {
        [result] = await database
          .select()
          .from(courses)
          .where(eq(courses.id, id))
          .limit(1);
        break;
      }
      case "ACADEMIC_YEAR": {
        [result] = await database
          .select()
          .from(academicYears)
          .where(eq(academicYears.id, id))
          .limit(1);
        break;
      }
      case "ACADEMIC_PERIOD": {
        [result] = await database
          .select()
          .from(academicPeriods)
          .where(eq(academicPeriods.id, id))
          .limit(1);
        break;
      }
      default: {
        throw new MasterDataDomainError(
          "INVALID_ENTITY_TYPE",
          "Jenis data master tidak didukung."
        );
      }
    }
    if (!result) {
      throw new MasterDataDomainError(
        "NOT_FOUND",
        "Data master tidak ditemukan."
      );
    }
    const [enriched] = await enrichReferenceLabels(database, entityType, [
      asRecord(result),
    ]);
    return enriched ?? asRecord(result);
  };

  // Server-side filters intentionally share one bounded list entry point.
  // eslint-disable-next-line complexity
  const list: MasterDataService["list"] = async ({
    cursor,
    entityType,
    limit,
    search,
    status,
  }) => {
    const offset = getCursorOffset(cursor);
    const normalizedSearch = search ? `%${normalizeText(search)}%` : null;
    let rows: MasterDataRecord[];
    switch (entityType) {
      case "STUDY_PROGRAM": {
        const conditions = status ? [eq(studyPrograms.status, status)] : [];
        if (normalizedSearch) {
          conditions.push(
            or(
              like(studyPrograms.code, normalizedSearch),
              like(studyPrograms.name, normalizedSearch)
            ) as never
          );
        }
        rows = await toRecords(
          database
            .select()
            .from(studyPrograms)
            .where(conditions.length ? and(...conditions) : undefined)
            .orderBy(desc(studyPrograms.createdAt))
            .limit(limit + 1)
            .offset(offset)
        );
        break;
      }
      case "COHORT": {
        const conditions = status ? [eq(cohorts.status, status)] : [];
        rows = await toRecords(
          database
            .select()
            .from(cohorts)
            .where(conditions.length ? and(...conditions) : undefined)
            .orderBy(desc(cohorts.createdAt))
            .limit(limit + 1)
            .offset(offset)
        );
        break;
      }
      case "STUDENT": {
        const conditions = status ? [eq(students.status, status)] : [];
        if (normalizedSearch) {
          conditions.push(
            or(
              like(students.nim, normalizedSearch),
              like(students.name, normalizedSearch)
            ) as never
          );
        }
        rows = await toRecords(
          database
            .select()
            .from(students)
            .where(conditions.length ? and(...conditions) : undefined)
            .orderBy(desc(students.createdAt))
            .limit(limit + 1)
            .offset(offset)
        );
        break;
      }
      case "LECTURER": {
        const conditions = status ? [eq(lecturers.status, status)] : [];
        if (normalizedSearch) {
          conditions.push(
            or(
              like(lecturers.name, normalizedSearch),
              like(lecturers.nidn, normalizedSearch),
              like(lecturers.nuptk, normalizedSearch)
            ) as never
          );
        }
        rows = await toRecords(
          database
            .select()
            .from(lecturers)
            .where(conditions.length ? and(...conditions) : undefined)
            .orderBy(desc(lecturers.createdAt))
            .limit(limit + 1)
            .offset(offset)
        );
        break;
      }
      case "ROOM": {
        const conditions = status ? [eq(rooms.status, status)] : [];
        if (normalizedSearch) {
          conditions.push(
            or(
              like(rooms.code, normalizedSearch),
              like(rooms.name, normalizedSearch)
            ) as never
          );
        }
        rows = await toRecords(
          database
            .select()
            .from(rooms)
            .where(conditions.length ? and(...conditions) : undefined)
            .orderBy(desc(rooms.createdAt))
            .limit(limit + 1)
            .offset(offset)
        );
        break;
      }
      case "COURSE": {
        const conditions = status ? [eq(courses.status, status)] : [];
        if (normalizedSearch) {
          conditions.push(
            or(
              like(courses.code, normalizedSearch),
              like(courses.name, normalizedSearch)
            ) as never
          );
        }
        rows = await toRecords(
          database
            .select()
            .from(courses)
            .where(conditions.length ? and(...conditions) : undefined)
            .orderBy(desc(courses.createdAt))
            .limit(limit + 1)
            .offset(offset)
        );
        break;
      }
      case "ACADEMIC_YEAR": {
        const conditions = status ? [eq(academicYears.status, status)] : [];
        if (normalizedSearch) {
          conditions.push(like(academicYears.code, normalizedSearch));
        }
        rows = await toRecords(
          database
            .select()
            .from(academicYears)
            .where(conditions.length ? and(...conditions) : undefined)
            .orderBy(desc(academicYears.createdAt))
            .limit(limit + 1)
            .offset(offset)
        );
        break;
      }
      case "ACADEMIC_PERIOD": {
        const conditions = status ? [eq(academicPeriods.status, status)] : [];
        rows = await toRecords(
          database
            .select()
            .from(academicPeriods)
            .where(conditions.length ? and(...conditions) : undefined)
            .orderBy(desc(academicPeriods.createdAt))
            .limit(limit + 1)
            .offset(offset)
        );
        break;
      }
      default: {
        throw new MasterDataDomainError(
          "INVALID_ENTITY_TYPE",
          "Jenis data master tidak didukung."
        );
      }
    }
    rows = await enrichReferenceLabels(database, entityType, rows);
    const hasMore = rows.length > limit;
    return {
      data: hasMore ? rows.slice(0, limit) : rows,
      nextCursor: hasMore ? String(offset + limit) : null,
    };
  };

  const summary: MasterDataService["summary"] = async () => {
    const [
      academicPeriodCount,
      academicYearCount,
      cohortCount,
      courseCount,
      lecturerCount,
      roomCount,
      studentCount,
      studyProgramCount,
    ] = await Promise.all([
      readStatusCount(
        database
          .select({
            active: sql<number>`sum(case when ${academicPeriods.status} = 'ACTIVE' then 1 else 0 end)`,
            archived: sql<number>`sum(case when ${academicPeriods.status} = 'ARCHIVED' then 1 else 0 end)`,
            total: sql<number>`count(*)`,
          })
          .from(academicPeriods)
      ),
      readStatusCount(
        database
          .select({
            active: sql<number>`sum(case when ${academicYears.status} = 'ACTIVE' then 1 else 0 end)`,
            archived: sql<number>`sum(case when ${academicYears.status} = 'ARCHIVED' then 1 else 0 end)`,
            total: sql<number>`count(*)`,
          })
          .from(academicYears)
      ),
      readStatusCount(
        database
          .select({
            active: sql<number>`sum(case when ${cohorts.status} = 'ACTIVE' then 1 else 0 end)`,
            archived: sql<number>`sum(case when ${cohorts.status} = 'ARCHIVED' then 1 else 0 end)`,
            total: sql<number>`count(*)`,
          })
          .from(cohorts)
      ),
      readStatusCount(
        database
          .select({
            active: sql<number>`sum(case when ${courses.status} = 'ACTIVE' then 1 else 0 end)`,
            archived: sql<number>`sum(case when ${courses.status} = 'ARCHIVED' then 1 else 0 end)`,
            total: sql<number>`count(*)`,
          })
          .from(courses)
      ),
      readStatusCount(
        database
          .select({
            active: sql<number>`sum(case when ${lecturers.status} = 'ACTIVE' then 1 else 0 end)`,
            archived: sql<number>`sum(case when ${lecturers.status} = 'ARCHIVED' then 1 else 0 end)`,
            total: sql<number>`count(*)`,
          })
          .from(lecturers)
      ),
      readStatusCount(
        database
          .select({
            active: sql<number>`sum(case when ${rooms.status} = 'ACTIVE' then 1 else 0 end)`,
            archived: sql<number>`sum(case when ${rooms.status} = 'ARCHIVED' then 1 else 0 end)`,
            total: sql<number>`count(*)`,
          })
          .from(rooms)
      ),
      readStatusCount(
        database
          .select({
            active: sql<number>`sum(case when ${students.status} = 'ACTIVE' then 1 else 0 end)`,
            archived: sql<number>`sum(case when ${students.status} = 'ARCHIVED' then 1 else 0 end)`,
            total: sql<number>`count(*)`,
          })
          .from(students)
      ),
      readStatusCount(
        database
          .select({
            active: sql<number>`sum(case when ${studyPrograms.status} = 'ACTIVE' then 1 else 0 end)`,
            archived: sql<number>`sum(case when ${studyPrograms.status} = 'ARCHIVED' then 1 else 0 end)`,
            total: sql<number>`count(*)`,
          })
          .from(studyPrograms)
      ),
    ]);
    const entityCounts = [
      { counts: academicPeriodCount, entityType: "ACADEMIC_PERIOD" as const },
      { counts: academicYearCount, entityType: "ACADEMIC_YEAR" as const },
      { counts: cohortCount, entityType: "COHORT" as const },
      { counts: courseCount, entityType: "COURSE" as const },
      { counts: lecturerCount, entityType: "LECTURER" as const },
      { counts: roomCount, entityType: "ROOM" as const },
      { counts: studentCount, entityType: "STUDENT" as const },
      { counts: studyProgramCount, entityType: "STUDY_PROGRAM" as const },
    ].map(({ counts, entityType }) => ({
      activeCount: counts.activeCount,
      archivedCount: counts.archivedCount,
      entityType,
      totalCount: counts.totalCount,
    }));
    const [importSummary] = await database
      .select({
        attentionCount: sql<number>`sum(case when ${importJobs.status} in ('READY', 'PARTIAL_FAILED', 'FAILED') then 1 else 0 end)`,
        completedCount: sql<number>`sum(case when ${importJobs.status} = 'COMPLETED' then 1 else 0 end)`,
        inProgressCount: sql<number>`sum(case when ${importJobs.status} in ('UPLOADED', 'VALIDATING', 'COMMITTING') then 1 else 0 end)`,
      })
      .from(importJobs);
    const recent = await database
      .select({
        createdAt: importJobs.createdAt,
        entityType: importJobs.entityType,
        filename: importJobs.filename,
        id: importJobs.id,
        invalidCount: importJobs.invalidCount,
        status: importJobs.status,
        totalRows: importJobs.totalRows,
        validCount: importJobs.validCount,
        warningCount: importJobs.warningCount,
      })
      .from(importJobs)
      .orderBy(desc(importJobs.createdAt))
      .limit(5);
    const totals = {
      activeCount: 0,
      archivedCount: 0,
      totalCount: 0,
    };
    for (const entity of entityCounts) {
      totals.activeCount += entity.activeCount;
      totals.archivedCount += entity.archivedCount;
      totals.totalCount += entity.totalCount;
    }
    return {
      entities: entityCounts,
      generatedAt: new Date().toISOString(),
      imports: {
        attentionCount: normalizeCount(importSummary?.attentionCount ?? null),
        completedCount: normalizeCount(importSummary?.completedCount ?? null),
        inProgressCount: normalizeCount(importSummary?.inProgressCount ?? null),
        recent: recent.map((job) => ({
          createdAt: job.createdAt?.toISOString() ?? new Date(0).toISOString(),
          entityType: job.entityType as MasterDataEntityType,
          filename: job.filename,
          id: job.id,
          invalidCount: job.invalidCount,
          status: job.status,
          totalRows: job.totalRows,
          validCount: job.validCount,
          warningCount: job.warningCount,
        })),
      },
      totals,
    };
  };

  // Manual create and import commit intentionally share these entity validations.
  // eslint-disable-next-line complexity
  const create: MasterDataService["create"] = async ({
    actorUserId,
    data,
    entityType,
    provisionAccount = false,
  }) => {
    const id = createUuidV7();
    const currentTime = now();
    let credential:
      | {
          identifier: string;
          temporaryPassword: string;
        }
      | undefined;
    switch (entityType) {
      case "STUDY_PROGRAM": {
        const row = {
          code: normalizeCode(valueAsString(data, "code")),
          createdAt: currentTime,
          degree: normalizeStudyProgramDegree(valueAsString(data, "degree")),
          id,
          name: valueAsString(data, "name"),
          status: normalizeStatus(data.status),
          updatedAt: currentTime,
        };
        await database.insert(studyPrograms).values(row);
        break;
      }
      case "COHORT": {
        const studyProgramId = valueAsString(data, "studyProgramId");
        await getActiveProgram(database, studyProgramId);
        const row = {
          createdAt: currentTime,
          entryYear: integerValue(data, "entryYear"),
          id,
          status: normalizeStatus(data.status),
          studyProgramId,
          updatedAt: currentTime,
        };
        await database.insert(cohorts).values(row);
        break;
      }
      case "STUDENT": {
        const nim = normalizeIdentifierValue(valueAsString(data, "nim"), "NIM");
        const studyProgramId = valueAsString(data, "studyProgramId");
        const cohortId = valueAsString(data, "cohortId");
        await getActiveProgram(database, studyProgramId);
        await getActiveCohort(database, cohortId, studyProgramId);
        await ensureIdentifierAvailable(database, "NIM", nim);
        const row = {
          academicStatus: normalizeText(
            String(data.academicStatus ?? "ACTIVE")
          ).toUpperCase(),
          archivedAt: null,
          cohortId,
          createdAt: currentTime,
          email: optionalString(data, "email")?.toLowerCase() ?? null,
          id,
          name: valueAsString(data, "name"),
          nim,
          phone: optionalString(data, "phone"),
          provisioningStatus: "PENDING_PROVISIONING" as const,
          status: normalizeStatus(data.status),
          studyProgramId,
          updatedAt: currentTime,
        };
        await database.insert(students).values(row);
        await replaceIdentifierUsages(database, "STUDENT", id, [
          { identifier: nim, identifierType: "NIM" },
        ]);
        if (provisionAccount) {
          if (!identityService) {
            throw new MasterDataDomainError(
              "IDENTITY_SERVICE_UNAVAILABLE",
              "Layanan identitas belum tersedia untuk menerbitkan akun mahasiswa."
            );
          }
          try {
            const account = await identityService.createAccount({
              actorUserId,
              email: row.email ?? undefined,
              identifier: nim,
              identityType: "MAHASISWA",
              masterRecordId: id,
              name: row.name,
            });
            await database
              .update(students)
              .set({
                provisioningStatus: "PROVISIONED",
                updatedAt: currentTime,
              })
              .where(eq(students.id, id));
            credential = {
              identifier: account.identifier,
              temporaryPassword: account.temporaryPassword,
            };
          } catch (error) {
            await database
              .update(students)
              .set({ provisioningStatus: "FAILED", updatedAt: currentTime })
              .where(eq(students.id, id));
            throw error;
          }
        } else {
          await emitProvisioningOutbox(database, "STUDENT", id, nim);
        }
        break;
      }
      case "LECTURER": {
        if (
          data.dsn !== undefined &&
          data.dsn !== null &&
          normalizeText(String(data.dsn))
        ) {
          throw new MasterDataDomainError(
            "DSN_NOT_IMPORTABLE",
            "Identifier DSN diterbitkan server dan tidak dapat diisi manual."
          );
        }
        const nidn = optionalString(data, "nidn");
        const nuptk = optionalString(data, "nuptk");
        const normalizedNidn = nidn
          ? normalizeIdentifierValue(nidn, "NIDN")
          : null;
        const normalizedNuptk = nuptk
          ? normalizeIdentifierValue(nuptk, "NUPTK")
          : null;
        if (normalizedNidn) {
          await ensureIdentifierAvailable(database, "NIDN", normalizedNidn);
        }
        if (normalizedNuptk) {
          await ensureIdentifierAvailable(database, "NUPTK", normalizedNuptk);
        }
        const row = {
          academicStatus: normalizeText(
            String(data.academicStatus ?? "ACTIVE")
          ).toUpperCase(),
          archivedAt: null,
          createdAt: currentTime,
          dsn: null,
          email: optionalString(data, "email")?.toLowerCase() ?? null,
          id,
          name: valueAsString(data, "name"),
          nidn: normalizedNidn,
          nuptk: normalizedNuptk,
          phone: optionalString(data, "phone"),
          provisioningStatus: "PENDING_PROVISIONING" as const,
          status: normalizeStatus(data.status),
          updatedAt: currentTime,
        };
        await database.insert(lecturers).values(row);
        await replaceIdentifierUsages(database, "LECTURER", id, [
          ...(normalizedNidn
            ? [{ identifier: normalizedNidn, identifierType: "NIDN" as const }]
            : []),
          ...(normalizedNuptk
            ? [
                {
                  identifier: normalizedNuptk,
                  identifierType: "NUPTK" as const,
                },
              ]
            : []),
        ]);
        if (provisionAccount) {
          if (!identityService) {
            throw new MasterDataDomainError(
              "IDENTITY_SERVICE_UNAVAILABLE",
              "Layanan identitas belum tersedia untuk menerbitkan akun dosen."
            );
          }
          try {
            const account = await identityService.createAccount({
              actorUserId,
              email: row.email ?? undefined,
              identityType: "DOSEN",
              masterRecordId: id,
              name: row.name,
            });
            await database
              .update(lecturers)
              .set({
                dsn: account.identifier,
                provisioningStatus: "PROVISIONED",
                updatedAt: currentTime,
              })
              .where(eq(lecturers.id, id));
            await replaceIdentifierUsages(database, "LECTURER", id, [
              ...(normalizedNidn
                ? [
                    {
                      identifier: normalizedNidn,
                      identifierType: "NIDN" as const,
                    },
                  ]
                : []),
              ...(normalizedNuptk
                ? [
                    {
                      identifier: normalizedNuptk,
                      identifierType: "NUPTK" as const,
                    },
                  ]
                : []),
              { identifier: account.identifier, identifierType: "DSN" },
            ]);
            credential = {
              identifier: account.identifier,
              temporaryPassword: account.temporaryPassword,
            };
          } catch (error) {
            await database
              .update(lecturers)
              .set({ provisioningStatus: "FAILED", updatedAt: currentTime })
              .where(eq(lecturers.id, id));
            throw error;
          }
        } else {
          await emitProvisioningOutbox(database, "LECTURER", id);
        }
        break;
      }
      case "ROOM": {
        const row = {
          capacity: integerValue(data, "capacity"),
          code: normalizeCode(valueAsString(data, "code")),
          createdAt: currentTime,
          id,
          latitude: coordinateValue(data, "latitude"),
          longitude: coordinateValue(data, "longitude"),
          name: valueAsString(data, "name"),
          status: normalizeStatus(data.status),
          updatedAt: currentTime,
        };
        if (row.capacity < 1) {
          throw new MasterDataDomainError(
            "INVALID_CAPACITY",
            "Kapasitas ruang harus positif."
          );
        }
        await database.insert(rooms).values(row);
        break;
      }
      case "COURSE": {
        await getActiveProgram(database, valueAsString(data, "studyProgramId"));
        const row = {
          code: normalizeCode(valueAsString(data, "code")),
          createdAt: currentTime,
          credits: integerValue(data, "credits"),
          defaultSemester: optionalIntegerValue(data, "defaultSemester"),
          id,
          name: valueAsString(data, "name"),
          status: normalizeStatus(data.status),
          studyProgramId: valueAsString(data, "studyProgramId"),
          updatedAt: currentTime,
        };
        if (row.credits < 1 || row.credits > 6) {
          throw new MasterDataDomainError(
            "INVALID_CREDITS",
            "SKS harus berada pada rentang 1 sampai 6."
          );
        }
        if (
          row.defaultSemester !== null &&
          (row.defaultSemester < 1 || row.defaultSemester > 14)
        ) {
          throw new MasterDataDomainError(
            "INVALID_SEMESTER",
            "Semester default harus berada pada rentang 1 sampai 14."
          );
        }
        await database.insert(courses).values(row);
        break;
      }
      case "ACADEMIC_YEAR": {
        const startYear = integerValue(data, "startYear");
        const endYear = integerValue(data, "endYear");
        if (endYear !== startYear + 1) {
          throw new MasterDataDomainError(
            "INVALID_ACADEMIC_YEAR",
            "Tahun akhir harus satu tahun setelah tahun mulai."
          );
        }
        await database.insert(academicYears).values({
          code: normalizeText(valueAsString(data, "code")),
          createdAt: currentTime,
          endYear,
          id,
          startYear,
          status: normalizeStatus(data.status),
          updatedAt: currentTime,
        });
        break;
      }
      case "ACADEMIC_PERIOD": {
        const academicYearId = valueAsString(data, "academicYearId");
        const [year] = await database
          .select()
          .from(academicYears)
          .where(
            and(
              eq(academicYears.id, academicYearId),
              eq(academicYears.status, "ACTIVE")
            )
          )
          .limit(1);
        if (!year) {
          throw new MasterDataDomainError(
            "REFERENCE_NOT_ACTIVE",
            "Tahun akademik tidak ditemukan atau tidak aktif."
          );
        }
        const startDate =
          data.startDate instanceof Date
            ? data.startDate
            : parseAcademicPeriodDate(
                valueAsString(data, "startDate"),
                "Tanggal mulai",
                "start"
              );
        const endDate =
          data.endDate instanceof Date
            ? data.endDate
            : parseAcademicPeriodDate(
                valueAsString(data, "endDate"),
                "Tanggal akhir",
                "end"
              );
        if (endDate < startDate) {
          throw new MasterDataDomainError(
            "INVALID_DATE_RANGE",
            "Tanggal akhir tidak boleh sebelum tanggal mulai."
          );
        }
        await database.insert(academicPeriods).values({
          academicYearId,
          createdAt: currentTime,
          endDate,
          id,
          startDate,
          status: String(data.status ?? "DRAFT").toUpperCase(),
          term: assertAcademicTerm(valueAsString(data, "term")),
          updatedAt: currentTime,
        });
        break;
      }
      default: {
        throw new MasterDataDomainError(
          "INVALID_ENTITY_TYPE",
          "Jenis data master tidak didukung."
        );
      }
    }
    const result = await get({ entityType, id });
    await createAudit(
      database,
      actorUserId,
      "CREATE",
      entityType,
      id,
      null,
      result
    );
    return credential ? { ...result, credential } : result;
  };

  const assertNotLocked = async (
    entityType: string,
    entityId: string
  ): Promise<void> => {
    const [usage] = await database
      .select({ identifier: identifierUsages.identifier })
      .from(identifierUsages)
      .where(
        and(
          eq(identifierUsages.entityType, entityType),
          eq(identifierUsages.entityId, entityId),
          isNotNull(identifierUsages.lockedAt)
        )
      )
      .limit(1);
    if (usage) {
      throw new MasterDataDomainError(
        "IDENTIFIER_LOCKED",
        `Identifier ${usage.identifier} sudah digunakan dalam transaksi akademik dan tidak dapat dikoreksi.`,
        { identifier: ["Lihat detail usage sebelum mengajukan koreksi."] }
      );
    }
  };

  // Identifier lock checks and entity-specific updates intentionally stay in one use case.
  // eslint-disable-next-line complexity
  const update: MasterDataService["update"] = async ({
    actorUserId,
    data,
    entityType,
    expectedVersion,
    id,
  }) => {
    const before = await get({ entityType, id });
    const currentVersion = getRecordVersion(before);
    if (currentVersion !== expectedVersion) {
      throw new MasterDataDomainError(
        "MASTER_DATA_VERSION_CONFLICT",
        "Data master sudah berubah. Muat ulang detail sebelum menyimpan perubahan.",
        undefined,
        {
          actualVersion: currentVersion,
          entityId: id,
          entityType,
          expectedVersion,
        }
      );
    }
    await assertNotLocked(entityType, id);
    const updatedAt = now();
    switch (entityType) {
      case "STUDY_PROGRAM": {
        await assertVersionedUpdate(
          database
            .update(studyPrograms)
            .set({
              code:
                data.code === undefined
                  ? String(before.code)
                  : normalizeCode(valueAsString(data, "code")),
              degree:
                data.degree === undefined
                  ? String(before.degree)
                  : normalizeStudyProgramDegree(valueAsString(data, "degree")),
              name:
                data.name === undefined
                  ? String(before.name)
                  : valueAsString(data, "name"),
              status:
                data.status === undefined
                  ? (before.status as "ACTIVE" | "ARCHIVED")
                  : normalizeStatus(data.status),
              updatedAt,
              version: sql`${studyPrograms.version} + 1`,
            })
            .where(
              and(
                eq(studyPrograms.id, id),
                eq(studyPrograms.version, expectedVersion)
              )
            )
            .returning({ id: studyPrograms.id }),
          entityType,
          id,
          expectedVersion
        );
        break;
      }
      case "COHORT": {
        if (data.studyProgramId !== undefined) {
          await getActiveProgram(
            database,
            valueAsString(data, "studyProgramId")
          );
        }
        await assertVersionedUpdate(
          database
            .update(cohorts)
            .set({
              entryYear:
                data.entryYear === undefined
                  ? Number(before.entryYear)
                  : integerValue(data, "entryYear"),
              status:
                data.status === undefined
                  ? (before.status as "ACTIVE" | "ARCHIVED")
                  : normalizeStatus(data.status),
              studyProgramId:
                data.studyProgramId === undefined
                  ? String(before.studyProgramId)
                  : valueAsString(data, "studyProgramId"),
              updatedAt,
              version: sql`${cohorts.version} + 1`,
            })
            .where(
              and(eq(cohorts.id, id), eq(cohorts.version, expectedVersion))
            )
            .returning({ id: cohorts.id }),
          entityType,
          id,
          expectedVersion
        );
        break;
      }
      case "STUDENT": {
        const studyProgramId =
          data.studyProgramId === undefined
            ? String(before.studyProgramId)
            : valueAsString(data, "studyProgramId");
        const cohortId =
          data.cohortId === undefined
            ? String(before.cohortId)
            : valueAsString(data, "cohortId");
        await getActiveProgram(database, studyProgramId);
        await getActiveCohort(database, cohortId, studyProgramId);
        const nim =
          data.nim === undefined
            ? String(before.nim)
            : normalizeIdentifierValue(valueAsString(data, "nim"), "NIM");
        await ensureIdentifierAvailable(database, "NIM", nim, id);
        await assertVersionedUpdate(
          database
            .update(students)
            .set({
              academicStatus:
                data.academicStatus === undefined
                  ? String(before.academicStatus)
                  : normalizeText(String(data.academicStatus)).toUpperCase(),
              cohortId,
              email:
                data.email === undefined
                  ? (before.email as string | null)
                  : (optionalString(data, "email")?.toLowerCase() ?? null),
              name:
                data.name === undefined
                  ? String(before.name)
                  : valueAsString(data, "name"),
              nim,
              phone:
                data.phone === undefined
                  ? (before.phone as string | null)
                  : optionalString(data, "phone"),
              status:
                data.status === undefined
                  ? (before.status as "ACTIVE" | "ARCHIVED")
                  : normalizeStatus(data.status),
              studyProgramId,
              updatedAt,
              version: sql`${students.version} + 1`,
            })
            .where(
              and(eq(students.id, id), eq(students.version, expectedVersion))
            )
            .returning({ id: students.id }),
          entityType,
          id,
          expectedVersion
        );
        await replaceIdentifierUsages(database, "STUDENT", id, [
          { identifier: nim, identifierType: "NIM" },
        ]);
        break;
      }
      case "LECTURER": {
        if (
          data.dsn !== undefined &&
          data.dsn !== null &&
          normalizeText(String(data.dsn))
        ) {
          throw new MasterDataDomainError(
            "DSN_NOT_IMPORTABLE",
            "Identifier DSN diterbitkan server dan tidak dapat diubah manual."
          );
        }
        const nidnValue =
          data.nidn === undefined
            ? (before.nidn as string | null)
            : optionalString(data, "nidn");
        const nuptkValue =
          data.nuptk === undefined
            ? (before.nuptk as string | null)
            : optionalString(data, "nuptk");
        const nidn = nidnValue
          ? normalizeIdentifierValue(nidnValue, "NIDN")
          : null;
        const nuptk = nuptkValue
          ? normalizeIdentifierValue(nuptkValue, "NUPTK")
          : null;
        if (nidn) {
          await ensureIdentifierAvailable(database, "NIDN", nidn, id);
        }
        if (nuptk) {
          await ensureIdentifierAvailable(database, "NUPTK", nuptk, id);
        }
        await assertVersionedUpdate(
          database
            .update(lecturers)
            .set({
              academicStatus:
                data.academicStatus === undefined
                  ? String(before.academicStatus)
                  : normalizeText(String(data.academicStatus)).toUpperCase(),
              email:
                data.email === undefined
                  ? (before.email as string | null)
                  : (optionalString(data, "email")?.toLowerCase() ?? null),
              name:
                data.name === undefined
                  ? String(before.name)
                  : valueAsString(data, "name"),
              nidn,
              nuptk,
              phone:
                data.phone === undefined
                  ? (before.phone as string | null)
                  : optionalString(data, "phone"),
              status:
                data.status === undefined
                  ? (before.status as "ACTIVE" | "ARCHIVED")
                  : normalizeStatus(data.status),
              updatedAt,
              version: sql`${lecturers.version} + 1`,
            })
            .where(
              and(eq(lecturers.id, id), eq(lecturers.version, expectedVersion))
            )
            .returning({ id: lecturers.id }),
          entityType,
          id,
          expectedVersion
        );
        await replaceIdentifierUsages(database, "LECTURER", id, [
          ...(nidn
            ? [{ identifier: nidn, identifierType: "NIDN" as const }]
            : []),
          ...(nuptk
            ? [{ identifier: nuptk, identifierType: "NUPTK" as const }]
            : []),
        ]);
        break;
      }
      case "ROOM": {
        await assertVersionedUpdate(
          database
            .update(rooms)
            .set({
              capacity:
                data.capacity === undefined
                  ? Number(before.capacity)
                  : integerValue(data, "capacity"),
              code:
                data.code === undefined
                  ? String(before.code)
                  : normalizeCode(valueAsString(data, "code")),
              latitude:
                data.latitude === undefined
                  ? Number(before.latitude)
                  : coordinateValue(data, "latitude"),
              longitude:
                data.longitude === undefined
                  ? Number(before.longitude)
                  : coordinateValue(data, "longitude"),
              name:
                data.name === undefined
                  ? String(before.name)
                  : valueAsString(data, "name"),
              status:
                data.status === undefined
                  ? (before.status as "ACTIVE" | "ARCHIVED")
                  : normalizeStatus(data.status),
              updatedAt,
              version: sql`${rooms.version} + 1`,
            })
            .where(and(eq(rooms.id, id), eq(rooms.version, expectedVersion)))
            .returning({ id: rooms.id }),
          entityType,
          id,
          expectedVersion
        );
        break;
      }
      case "COURSE": {
        const studyProgramId =
          data.studyProgramId === undefined
            ? String(before.studyProgramId)
            : valueAsString(data, "studyProgramId");
        await getActiveProgram(database, studyProgramId);
        const previousDefaultSemester =
          before.defaultSemester === null ||
          before.defaultSemester === undefined
            ? null
            : Number(before.defaultSemester);
        const defaultSemester =
          data.defaultSemester === undefined
            ? previousDefaultSemester
            : optionalIntegerValue(data, "defaultSemester");
        if (
          defaultSemester !== null &&
          (defaultSemester < 1 || defaultSemester > 14)
        ) {
          throw new MasterDataDomainError(
            "INVALID_SEMESTER",
            "Semester harus berada pada rentang 1 sampai 14."
          );
        }
        await assertVersionedUpdate(
          database
            .update(courses)
            .set({
              code:
                data.code === undefined
                  ? String(before.code)
                  : normalizeCode(valueAsString(data, "code")),
              credits:
                data.credits === undefined
                  ? Number(before.credits)
                  : integerValue(data, "credits"),
              defaultSemester,
              name:
                data.name === undefined
                  ? String(before.name)
                  : valueAsString(data, "name"),
              status:
                data.status === undefined
                  ? (before.status as "ACTIVE" | "ARCHIVED")
                  : normalizeStatus(data.status),
              studyProgramId,
              updatedAt,
              version: sql`${courses.version} + 1`,
            })
            .where(
              and(eq(courses.id, id), eq(courses.version, expectedVersion))
            )
            .returning({ id: courses.id }),
          entityType,
          id,
          expectedVersion
        );
        break;
      }
      case "ACADEMIC_YEAR": {
        const startYear =
          data.startYear === undefined
            ? Number(before.startYear)
            : integerValue(data, "startYear");
        const endYear =
          data.endYear === undefined
            ? Number(before.endYear)
            : integerValue(data, "endYear");
        if (endYear !== startYear + 1) {
          throw new MasterDataDomainError(
            "INVALID_ACADEMIC_YEAR",
            "Tahun akhir harus satu tahun setelah tahun mulai."
          );
        }
        await assertVersionedUpdate(
          database
            .update(academicYears)
            .set({
              code:
                data.code === undefined
                  ? String(before.code)
                  : normalizeText(valueAsString(data, "code")),
              endYear,
              startYear,
              status:
                data.status === undefined
                  ? (before.status as "ACTIVE" | "ARCHIVED")
                  : normalizeStatus(data.status),
              updatedAt,
              version: sql`${academicYears.version} + 1`,
            })
            .where(
              and(
                eq(academicYears.id, id),
                eq(academicYears.version, expectedVersion)
              )
            )
            .returning({ id: academicYears.id }),
          entityType,
          id,
          expectedVersion
        );
        break;
      }
      case "ACADEMIC_PERIOD": {
        const startDate =
          data.startDate === undefined
            ? new Date(String(before.startDate))
            : parseAcademicPeriodDate(
                valueAsString(data, "startDate"),
                "Tanggal mulai",
                "start"
              );
        const endDate =
          data.endDate === undefined
            ? new Date(String(before.endDate))
            : parseAcademicPeriodDate(
                valueAsString(data, "endDate"),
                "Tanggal akhir",
                "end"
              );
        if (endDate < startDate) {
          throw new MasterDataDomainError(
            "INVALID_DATE_RANGE",
            "Tanggal akhir tidak boleh sebelum tanggal mulai."
          );
        }
        const academicYearId =
          data.academicYearId === undefined
            ? String(before.academicYearId)
            : valueAsString(data, "academicYearId");
        if (data.academicYearId !== undefined) {
          await getActiveAcademicYear(database, academicYearId);
        }
        await assertVersionedUpdate(
          database
            .update(academicPeriods)
            .set({
              academicYearId,
              endDate,
              startDate,
              status:
                data.status === undefined
                  ? String(before.status)
                  : normalizeText(String(data.status)).toUpperCase(),
              term:
                data.term === undefined
                  ? String(before.term)
                  : assertAcademicTerm(valueAsString(data, "term")),
              updatedAt,
              version: sql`${academicPeriods.version} + 1`,
            })
            .where(
              and(
                eq(academicPeriods.id, id),
                eq(academicPeriods.version, expectedVersion)
              )
            )
            .returning({ id: academicPeriods.id }),
          entityType,
          id,
          expectedVersion
        );
        break;
      }
      default: {
        throw new MasterDataDomainError(
          "INVALID_ENTITY_TYPE",
          "Jenis data master tidak didukung."
        );
      }
    }
    const result = await get({ entityType, id });
    await createAudit(
      database,
      actorUserId,
      "UPDATE",
      entityType,
      id,
      before,
      result
    );
    return result;
  };

  const setStatus = async ({
    actorUserId,
    entityType,
    expectedVersion,
    id,
    status,
  }: {
    actorUserId: string;
    entityType: MasterDataEntityType;
    id: string;
    expectedVersion: number;
    status: "ACTIVE" | "ARCHIVED";
  }): Promise<void> => {
    const before = await get({ entityType, id });
    switch (entityType) {
      case "STUDY_PROGRAM": {
        await assertVersionedUpdate(
          database
            .update(studyPrograms)
            .set({
              archivedAt: status === "ARCHIVED" ? now() : null,
              status,
              updatedAt: now(),
              version: sql`${studyPrograms.version} + 1`,
            })
            .where(
              and(
                eq(studyPrograms.id, id),
                eq(studyPrograms.version, expectedVersion)
              )
            )
            .returning({ id: studyPrograms.id }),
          entityType,
          id,
          expectedVersion
        );
        break;
      }
      case "COHORT": {
        await assertVersionedUpdate(
          database
            .update(cohorts)
            .set({
              status,
              updatedAt: now(),
              version: sql`${cohorts.version} + 1`,
            })
            .where(
              and(eq(cohorts.id, id), eq(cohorts.version, expectedVersion))
            )
            .returning({ id: cohorts.id }),
          entityType,
          id,
          expectedVersion
        );
        break;
      }
      case "STUDENT": {
        await assertVersionedUpdate(
          database
            .update(students)
            .set({
              archivedAt: status === "ARCHIVED" ? now() : null,
              status,
              updatedAt: now(),
              version: sql`${students.version} + 1`,
            })
            .where(
              and(eq(students.id, id), eq(students.version, expectedVersion))
            )
            .returning({ id: students.id }),
          entityType,
          id,
          expectedVersion
        );
        break;
      }
      case "LECTURER": {
        await assertVersionedUpdate(
          database
            .update(lecturers)
            .set({
              archivedAt: status === "ARCHIVED" ? now() : null,
              status,
              updatedAt: now(),
              version: sql`${lecturers.version} + 1`,
            })
            .where(
              and(eq(lecturers.id, id), eq(lecturers.version, expectedVersion))
            )
            .returning({ id: lecturers.id }),
          entityType,
          id,
          expectedVersion
        );
        break;
      }
      case "ROOM": {
        await assertVersionedUpdate(
          database
            .update(rooms)
            .set({
              status,
              updatedAt: now(),
              version: sql`${rooms.version} + 1`,
            })
            .where(and(eq(rooms.id, id), eq(rooms.version, expectedVersion)))
            .returning({ id: rooms.id }),
          entityType,
          id,
          expectedVersion
        );
        break;
      }
      case "COURSE": {
        await assertVersionedUpdate(
          database
            .update(courses)
            .set({
              status,
              updatedAt: now(),
              version: sql`${courses.version} + 1`,
            })
            .where(
              and(eq(courses.id, id), eq(courses.version, expectedVersion))
            )
            .returning({ id: courses.id }),
          entityType,
          id,
          expectedVersion
        );
        break;
      }
      case "ACADEMIC_YEAR": {
        await assertVersionedUpdate(
          database
            .update(academicYears)
            .set({
              status,
              updatedAt: now(),
              version: sql`${academicYears.version} + 1`,
            })
            .where(
              and(
                eq(academicYears.id, id),
                eq(academicYears.version, expectedVersion)
              )
            )
            .returning({ id: academicYears.id }),
          entityType,
          id,
          expectedVersion
        );
        break;
      }
      case "ACADEMIC_PERIOD": {
        await assertVersionedUpdate(
          database
            .update(academicPeriods)
            .set({
              status,
              updatedAt: now(),
              version: sql`${academicPeriods.version} + 1`,
            })
            .where(
              and(
                eq(academicPeriods.id, id),
                eq(academicPeriods.version, expectedVersion)
              )
            )
            .returning({ id: academicPeriods.id }),
          entityType,
          id,
          expectedVersion
        );
        break;
      }
      default: {
        throw new MasterDataDomainError(
          "INVALID_ENTITY_TYPE",
          "Jenis data master tidak didukung."
        );
      }
    }
    await createAudit(
      database,
      actorUserId,
      status === "ARCHIVED" ? "ARCHIVE" : "REACTIVATE",
      entityType,
      id,
      before,
      await get({ entityType, id })
    );
  };

  const changeAcademicPeriodStatus: MasterDataService["changeAcademicPeriodStatus"] =
    async ({ actorUserId, expectedVersion, id, status }) => {
      const before = await get({ entityType: "ACADEMIC_PERIOD", id });
      const currentStatus = String(before.status);
      if (
        !academicPeriodStatusesList.includes(
          currentStatus as AcademicPeriodStatus
        )
      ) {
        throw new MasterDataDomainError(
          "INVALID_STATUS_TRANSITION",
          "Periode yang diarsipkan harus diaktifkan kembali sebelum statusnya diubah."
        );
      }
      assertAcademicPeriodStatusTransition(
        currentStatus as AcademicPeriodStatus,
        status
      );
      if (currentStatus === status) {
        return;
      }
      await assertVersionedUpdate(
        database
          .update(academicPeriods)
          .set({
            status,
            updatedAt: now(),
            version: sql`${academicPeriods.version} + 1`,
          })
          .where(
            and(
              eq(academicPeriods.id, id),
              eq(academicPeriods.version, expectedVersion)
            )
          )
          .returning({ id: academicPeriods.id }),
        "ACADEMIC_PERIOD",
        id,
        expectedVersion
      );
      await createAudit(
        database,
        actorUserId,
        "UPDATE",
        "ACADEMIC_PERIOD",
        id,
        before,
        await get({ entityType: "ACADEMIC_PERIOD", id })
      );
    };

  // Import validation reports all field issues in one pass for the preview.
  // eslint-disable-next-line complexity
  const validateImportRow = async (
    entityType: MasterDataEntityType,
    row: MasterDataRecord,
    seenKeys: Set<string>
  ): Promise<{
    data: MasterDataRecord;
    errors: string[];
    status: "INVALID" | "VALID" | "WARNING";
  }> => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const normalized: MasterDataRecord = {};
    try {
      switch (entityType) {
        case "STUDY_PROGRAM": {
          normalized.code = normalizeCode(valueAsString(row, "code"));
          normalized.name = valueAsString(row, "name");
          normalized.degree = normalizeStudyProgramDegree(
            valueAsString(row, "degree")
          );
          await ensureRecordAbsent(
            database
              .select({ id: studyPrograms.id })
              .from(studyPrograms)
              .where(eq(studyPrograms.code, normalized.code as string))
              .limit(1),
            "Kode Prodi sudah ada di database."
          );
          const key = `code:${normalized.code}`;
          if (seenKeys.has(key)) {
            errors.push("Kode Prodi duplikat antarbaris.");
          }
          seenKeys.add(key);
          break;
        }
        case "COHORT": {
          normalized.studyProgramCode = normalizeCode(
            valueAsString(row, "study_program_code"),
            "Kode Prodi"
          );
          normalized.entryYear = parseInteger(
            valueAsString(row, "entry_year"),
            "Tahun masuk"
          );
          const [program] = await database
            .select({ id: studyPrograms.id })
            .from(studyPrograms)
            .where(
              and(
                eq(studyPrograms.code, normalized.studyProgramCode as string),
                eq(studyPrograms.status, "ACTIVE")
              )
            )
            .limit(1);
          if (program) {
            normalized.studyProgramId = program.id;
            await ensureRecordAbsent(
              database
                .select({ id: cohorts.id })
                .from(cohorts)
                .where(
                  and(
                    eq(cohorts.studyProgramId, program.id),
                    eq(cohorts.entryYear, normalized.entryYear as number)
                  )
                )
                .limit(1),
              "Angkatan sudah ada di database."
            );
          } else {
            errors.push("Prodi tidak ditemukan atau tidak aktif.");
          }
          const key = `cohort:${normalized.studyProgramCode}:${normalized.entryYear}`;
          if (seenKeys.has(key)) {
            errors.push("Angkatan duplikat antarbaris.");
          }
          seenKeys.add(key);
          break;
        }
        case "STUDENT": {
          normalized.nim = normalizeIdentifierValue(
            valueAsString(row, "nim"),
            "NIM"
          );
          normalized.name = valueAsString(row, "name");
          normalized.studyProgramCode = normalizeCode(
            valueAsString(row, "study_program_code"),
            "Kode Prodi"
          );
          normalized.cohortEntryYear = parseInteger(
            valueAsString(row, "cohort_entry_year"),
            "Tahun angkatan"
          );
          normalized.email = optionalString(row, "email")?.toLowerCase();
          normalized.phone = optionalString(row, "phone");
          const [program] = await database
            .select({ id: studyPrograms.id })
            .from(studyPrograms)
            .where(
              and(
                eq(studyPrograms.code, normalized.studyProgramCode as string),
                eq(studyPrograms.status, "ACTIVE")
              )
            )
            .limit(1);
          if (program) {
            normalized.studyProgramId = program.id;
          } else {
            errors.push("Prodi tidak ditemukan atau tidak aktif.");
          }
          if (program) {
            const [cohort] = await database
              .select({ id: cohorts.id })
              .from(cohorts)
              .where(
                and(
                  eq(cohorts.studyProgramId, program.id),
                  eq(cohorts.entryYear, normalized.cohortEntryYear as number),
                  eq(cohorts.status, "ACTIVE")
                )
              )
              .limit(1);
            if (cohort) {
              normalized.cohortId = cohort.id;
            } else {
              errors.push("Angkatan tidak ditemukan atau tidak aktif.");
            }
          }
          const key = `student:${normalized.nim}`;
          if (seenKeys.has(key)) {
            errors.push("NIM duplikat antarbaris.");
          }
          seenKeys.add(key);
          const [existing] = await database
            .select({ id: students.id })
            .from(students)
            .where(eq(students.nim, normalized.nim as string))
            .limit(1);
          if (existing) {
            errors.push("NIM sudah ada di database.");
          }
          if (!normalized.email) {
            warnings.push("Email belum diisi.");
          }
          break;
        }
        case "LECTURER": {
          normalized.name = valueAsString(row, "name");
          const nidn = optionalString(row, "nidn");
          const nuptk = optionalString(row, "nuptk");
          normalized.nidn = nidn
            ? normalizeIdentifierValue(nidn, "NIDN")
            : null;
          normalized.nuptk = nuptk
            ? normalizeIdentifierValue(nuptk, "NUPTK")
            : null;
          normalized.email = optionalString(row, "email")?.toLowerCase();
          normalized.phone = optionalString(row, "phone");
          if (!normalized.nidn && !normalized.nuptk) {
            warnings.push("NIDN dan NUPTK belum diisi.");
          }
          if (!normalized.email) {
            warnings.push("Email belum diisi.");
          }
          const key = `lecturer:${normalized.nidn ?? normalized.nuptk ?? normalized.name}`;
          if (seenKeys.has(key)) {
            errors.push("Data Dosen duplikat antarbaris.");
          }
          seenKeys.add(key);
          if (normalized.nidn) {
            const [existing] = await database
              .select({ id: lecturers.id })
              .from(lecturers)
              .where(eq(lecturers.nidn, normalized.nidn as string))
              .limit(1);
            if (existing) {
              errors.push("NIDN sudah ada di database.");
            }
          }
          if (normalized.nuptk) {
            const [existing] = await database
              .select({ id: lecturers.id })
              .from(lecturers)
              .where(eq(lecturers.nuptk, normalized.nuptk as string))
              .limit(1);
            if (existing) {
              errors.push("NUPTK sudah ada di database.");
            }
          }
          break;
        }
        case "ROOM": {
          normalized.code = normalizeCode(valueAsString(row, "code"));
          normalized.name = valueAsString(row, "name");
          normalized.capacity = parseInteger(
            valueAsString(row, "capacity"),
            "Kapasitas"
          );
          normalized.latitude = parseCoordinate(
            valueAsString(row, "latitude"),
            "latitude"
          );
          normalized.longitude = parseCoordinate(
            valueAsString(row, "longitude"),
            "longitude"
          );
          await ensureRecordAbsent(
            database
              .select({ id: rooms.id })
              .from(rooms)
              .where(eq(rooms.code, normalized.code as string))
              .limit(1),
            "Kode ruang sudah ada di database."
          );
          if ((normalized.capacity as number) < 1) {
            errors.push("Kapasitas harus positif.");
          }
          if (seenKeys.has(`room:${normalized.code}`)) {
            errors.push("Kode ruang duplikat antarbaris.");
          }
          seenKeys.add(`room:${normalized.code}`);
          break;
        }
        case "COURSE": {
          normalized.code = normalizeCode(valueAsString(row, "code"));
          normalized.name = valueAsString(row, "name");
          normalized.credits = parseInteger(
            valueAsString(row, "credits"),
            "SKS"
          );
          normalized.defaultSemester = parseInteger(
            valueAsString(row, "default_semester"),
            "Semester default"
          );
          normalized.studyProgramCode = normalizeCode(
            valueAsString(row, "study_program_code"),
            "Kode Prodi"
          );
          const [program] = await database
            .select({ id: studyPrograms.id })
            .from(studyPrograms)
            .where(
              and(
                eq(studyPrograms.code, normalized.studyProgramCode as string),
                eq(studyPrograms.status, "ACTIVE")
              )
            )
            .limit(1);
          if (program) {
            normalized.studyProgramId = program.id;
          } else {
            errors.push("Prodi tidak ditemukan atau tidak aktif.");
          }
          await ensureRecordAbsent(
            database
              .select({ id: courses.id })
              .from(courses)
              .where(eq(courses.code, normalized.code as string))
              .limit(1),
            "Kode mata kuliah sudah ada di database."
          );
          if (
            (normalized.credits as number) < 1 ||
            (normalized.credits as number) > 6
          ) {
            errors.push("SKS harus 1 sampai 6.");
          }
          if (
            (normalized.defaultSemester as number) < 1 ||
            (normalized.defaultSemester as number) > 14
          ) {
            errors.push("Semester default harus 1 sampai 14.");
          }
          if (seenKeys.has(`course:${normalized.code}`)) {
            errors.push("Kode mata kuliah duplikat antarbaris.");
          }
          seenKeys.add(`course:${normalized.code}`);
          break;
        }
        case "ACADEMIC_YEAR": {
          normalized.code = normalizeText(valueAsString(row, "code"));
          normalized.startYear = parseInteger(
            valueAsString(row, "start_year"),
            "Tahun mulai"
          );
          normalized.endYear = parseInteger(
            valueAsString(row, "end_year"),
            "Tahun akhir"
          );
          await ensureRecordAbsent(
            database
              .select({ id: academicYears.id })
              .from(academicYears)
              .where(eq(academicYears.code, normalized.code as string))
              .limit(1),
            "Kode tahun akademik sudah ada di database."
          );
          if (normalized.endYear !== (normalized.startYear as number) + 1) {
            errors.push("Tahun akhir harus satu tahun setelah tahun mulai.");
          }
          if (seenKeys.has(`year:${normalized.code}`)) {
            errors.push("Tahun akademik duplikat antarbaris.");
          }
          seenKeys.add(`year:${normalized.code}`);
          break;
        }
        case "ACADEMIC_PERIOD": {
          normalized.academicYearCode = normalizeText(
            valueAsString(row, "academic_year_code")
          );
          normalized.term = assertAcademicTerm(valueAsString(row, "term"));
          normalized.startDate = parseAcademicPeriodDate(
            valueAsString(row, "start_date"),
            "Tanggal mulai",
            "start"
          );
          normalized.endDate = parseAcademicPeriodDate(
            valueAsString(row, "end_date"),
            "Tanggal akhir",
            "end"
          );
          if ((normalized.endDate as Date) < (normalized.startDate as Date)) {
            errors.push("Tanggal akhir tidak boleh sebelum tanggal mulai.");
          }
          const [year] = await database
            .select({ id: academicYears.id })
            .from(academicYears)
            .where(
              and(
                eq(academicYears.code, normalized.academicYearCode as string),
                eq(academicYears.status, "ACTIVE")
              )
            )
            .limit(1);
          if (year) {
            normalized.academicYearId = year.id;
            await ensureRecordAbsent(
              database
                .select({ id: academicPeriods.id })
                .from(academicPeriods)
                .where(
                  and(
                    eq(academicPeriods.academicYearId, year.id),
                    eq(academicPeriods.term, normalized.term as string)
                  )
                )
                .limit(1),
              "Periode sudah ada di database."
            );
          } else {
            errors.push("Tahun akademik tidak ditemukan atau tidak aktif.");
          }
          if (
            seenKeys.has(
              `period:${normalized.academicYearCode}:${normalized.term}`
            )
          ) {
            errors.push("Periode duplikat antarbaris.");
          }
          seenKeys.add(
            `period:${normalized.academicYearCode}:${normalized.term}`
          );
          break;
        }
        default: {
          throw new MasterDataDomainError(
            "INVALID_ENTITY_TYPE",
            "Jenis data master tidak didukung."
          );
        }
      }
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : "Format baris tidak valid."
      );
    }
    let status: "INVALID" | "VALID" | "WARNING" = "VALID";
    if (warnings.length > 0) {
      status = "WARNING";
    }
    if (errors.length > 0) {
      status = "INVALID";
    }
    return {
      data: normalized,
      errors: [...errors, ...warnings],
      status,
    };
  };

  const createImport: MasterDataService["createImport"] = async ({
    actorUserId,
    checksum,
    entityType,
    filename,
    rows: inputRows,
    templateVersion,
  }) => {
    assertTemplateVersion(templateVersion);
    const [duplicate] = await database
      .select({ id: importJobs.id })
      .from(importJobs)
      .where(
        and(
          eq(importJobs.checksum, checksum),
          eq(importJobs.entityType, entityType)
        )
      )
      .limit(1);
    if (duplicate) {
      throw new MasterDataDomainError(
        "DUPLICATE_FILE",
        "File yang sama sudah pernah diproses untuk entity ini."
      );
    }
    if (inputRows.length === 0) {
      throw new MasterDataDomainError(
        "EMPTY_FILE",
        "File import tidak memiliki data untuk diproses."
      );
    }
    const headers = templateHeaders(entityType);
    const jobId = createUuidV7();
    const saveImportMetadata = async (): Promise<void> => {
      await database.insert(importJobs).values({
        checksum,
        createdAt: now(),
        createdBy: actorUserId,
        entityType,
        fileObjectId: null,
        filename: normalizeText(filename),
        id: jobId,
        status: "VALIDATING",
        templateVersion,
      });
    };
    await saveImportMetadata();
    const seenKeys = new Set<string>();
    let validCount = 0;
    let warningCount = 0;
    let invalidCount = 0;
    const stagedRows: (typeof importRows.$inferInsert)[] = [];
    const flushRows = async (): Promise<void> => {
      if (stagedRows.length === 0) {
        return;
      }
      await database.insert(importRows).values(stagedRows.splice(0));
    };
    let rowNumber = 1;
    for (const rawData of inputRows) {
      rowNumber += 1;
      const filteredData = Object.fromEntries(
        headers.map((header) => [header, rawData[header] ?? ""])
      );
      // Keep validation ordered so row numbers and staging checkpoints are deterministic.
      // eslint-disable-next-line no-await-in-loop
      const result = await validateImportRow(
        entityType,
        filteredData,
        seenKeys
      );
      if (result.status === "VALID") {
        validCount += 1;
      }
      if (result.status === "WARNING") {
        warningCount += 1;
      }
      if (result.status === "INVALID") {
        invalidCount += 1;
      }
      stagedRows.push({
        createdAt: now(),
        errors: result.errors.length ? JSON.stringify(result.errors) : null,
        id: createUuidV7(),
        jobId,
        normalizedData: JSON.stringify(result.data, (_key, value: unknown) =>
          value instanceof Date ? value.toISOString() : value
        ),
        rawData: JSON.stringify(filteredData),
        rowNumber,
        status: result.status,
      });
      if (stagedRows.length >= IMPORT_ROW_BATCH_SIZE) {
        // Flushes are sequential to preserve the resumable checkpoint boundary.
        // eslint-disable-next-line no-await-in-loop
        await flushRows();
      }
    }
    await flushRows();
    const totalRows = inputRows.length;
    await database
      .update(importJobs)
      .set({
        checkpointRow: 0,
        errorCount: invalidCount,
        invalidCount,
        processedRows: 0,
        status: invalidCount === totalRows ? "PARTIAL_FAILED" : "READY",
        totalRows,
        validCount,
        warningCount,
      })
      .where(eq(importJobs.id, jobId));
    return {
      id: jobId,
      status: invalidCount === totalRows ? "PARTIAL_FAILED" : "READY",
      summary: { invalidCount, totalRows, validCount, warningCount },
    };
  };

  const previewImport: MasterDataService["previewImport"] = async ({
    jobId,
    limit,
    status,
  }) => {
    const [job] = await database
      .select()
      .from(importJobs)
      .where(eq(importJobs.id, jobId))
      .limit(1);
    if (!job) {
      throw new MasterDataDomainError(
        "NOT_FOUND",
        "Import job tidak ditemukan."
      );
    }
    const rows = await database
      .select()
      .from(importRows)
      .where(
        status
          ? and(eq(importRows.jobId, jobId), eq(importRows.status, status))
          : eq(importRows.jobId, jobId)
      )
      .orderBy(importRows.rowNumber)
      .limit(limit);
    return { data: rows.map(asRecord), job: asRecord(job) };
  };

  const commitImport: MasterDataService["commitImport"] = async ({
    actorUserId,
    jobId,
    limit,
  }) => {
    const [job] = await database
      .select()
      .from(importJobs)
      .where(eq(importJobs.id, jobId))
      .limit(1);
    if (!job) {
      throw new MasterDataDomainError(
        "NOT_FOUND",
        "Import job tidak ditemukan."
      );
    }
    const pendingRows = await database
      .select()
      .from(importRows)
      .where(
        and(
          eq(importRows.jobId, jobId),
          inArray(importRows.status, ["VALID", "WARNING"]),
          inArray(importRows.commitStatus, ["PENDING", "FAILED"])
        )
      )
      .orderBy(importRows.rowNumber)
      .limit(limit);
    let processed = 0;
    let failed = 0;
    for (const row of pendingRows) {
      try {
        const normalizedData = row.normalizedData
          ? (JSON.parse(row.normalizedData) as MasterDataRecord)
          : {};
        // Commit rows sequentially so one failed row cannot hide the checkpoint of another.
        // eslint-disable-next-line no-await-in-loop
        const entity = await create({
          actorUserId,
          data: normalizedData,
          entityType: job.entityType as MasterDataEntityType,
        });
        // eslint-disable-next-line no-await-in-loop
        await database
          .update(importRows)
          .set({
            commitError: null,
            commitStatus: "COMMITTED",
            entityId: String(entity.id),
          })
          .where(eq(importRows.id, row.id));
        processed += 1;
      } catch (error) {
        failed += 1;
        // eslint-disable-next-line no-await-in-loop
        await database
          .update(importRows)
          .set({
            commitError:
              error instanceof Error ? error.message : "Baris gagal diproses.",
            commitStatus: "FAILED",
          })
          .where(eq(importRows.id, row.id));
      }
    }
    const [remaining] = await database
      .select({ id: importRows.id })
      .from(importRows)
      .where(
        and(
          eq(importRows.jobId, jobId),
          inArray(importRows.status, ["VALID", "WARNING"]),
          inArray(importRows.commitStatus, ["PENDING", "FAILED"])
        )
      )
      .limit(1);
    let nextStatus: "COMMITTING" | "COMPLETED" | "PARTIAL_FAILED" = "COMPLETED";
    if (remaining) {
      nextStatus = "COMMITTING";
    } else if (job.invalidCount > 0 || failed > 0) {
      nextStatus = "PARTIAL_FAILED";
    }
    await database
      .update(importJobs)
      .set({
        checkpointRow: pendingRows.at(-1)?.rowNumber ?? job.checkpointRow,
        committedAt: remaining ? null : now(),
        errorCount: job.errorCount + failed,
        processedRows: job.processedRows + processed,
        status: nextStatus,
      })
      .where(eq(importJobs.id, jobId));
    const [updated] = await database
      .select()
      .from(importJobs)
      .where(eq(importJobs.id, jobId))
      .limit(1);
    return {
      ...(updated ? asRecord(updated) : {}),
      failedThisRun: failed,
      processedThisRun: processed,
    };
  };

  const exportData: MasterDataService["export"] = async ({
    entityType,
    search,
    status,
  }) => {
    const all: MasterDataRecord[] = [];
    let cursor: string | undefined;
    do {
      // Pagination depends on the previous cursor.
      // eslint-disable-next-line no-await-in-loop
      const page = await list({
        cursor,
        entityType,
        limit: 100,
        search,
        status,
      });
      all.push(...page.data);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return all;
  };

  return {
    archive: (input) => setStatus({ ...input, status: "ARCHIVED" }),
    changeAcademicPeriodStatus,
    commitImport,
    create,
    createImport,
    export: exportData,
    get,
    list,
    previewImport,
    reactivate: (input) => setStatus({ ...input, status: "ACTIVE" }),
    summary,
    update,
  };
};
