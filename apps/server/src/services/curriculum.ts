import type { FileStorage } from "@server/services/storage";
import {
  createPrivateObjectKey,
  uploadWithCompensation,
  validateFileMetadata,
} from "@server/services/storage";
import type { CurriculumService } from "@siakad-itbkmmubar/api/context";
import {
  DEFAULT_COURSE_ASSESSMENT_COMPONENTS,
  CurriculumDomainError,
  assertCurriculumManageRole,
  assertCurriculumRole,
  normalizeCurriculumName,
  validateAssessmentComponents,
  validateCurriculumStructure,
} from "@siakad-itbkmmubar/api/curriculum";
import type {
  CurriculumAssessmentComponent,
  CurriculumCourseInput,
  CurriculumDocumentRecord,
  CurriculumListItem,
  CurriculumRecord,
} from "@siakad-itbkmmubar/api/curriculum";
import type { RoleKey } from "@siakad-itbkmmubar/api/identity";
import type { Database } from "@siakad-itbkmmubar/db";
import {
  courseAssessmentDefaults,
  curriculumAssessmentOverrides,
  curriculumCourses,
  curriculumDocuments,
  curricula,
} from "@siakad-itbkmmubar/db/schema/curriculum";
import { programHeads } from "@siakad-itbkmmubar/db/schema/identity";
import {
  courses,
  cohorts,
  studyPrograms,
} from "@siakad-itbkmmubar/db/schema/master-data";
import {
  auditLogs,
  fileObjects,
  outboxEvents,
} from "@siakad-itbkmmubar/db/schema/platform";
import { and, desc, eq, gt, inArray, isNull, lte, ne, or } from "drizzle-orm";

interface CurriculumActor {
  actorRoles: readonly RoleKey[];
  actorUserId: string;
}

interface CurriculumHeader {
  cohort: { entryYear: number; id: string };
  curriculum: typeof curricula.$inferSelect;
  studyProgram: { code: string; id: string; name: string };
}

const toIso = (date: Date): string => date.toISOString();

const isSuperadmin = (roles: readonly RoleKey[]): boolean =>
  roles.includes("SUPERADMIN");

const baseReadCondition = (actor: CurriculumActor, now: Date) =>
  isSuperadmin(actor.actorRoles)
    ? undefined
    : and(
        eq(programHeads.userId, actor.actorUserId),
        lte(programHeads.startsAt, now),
        or(isNull(programHeads.endsAt), gt(programHeads.endsAt, now))
      );

const unique = (values: readonly string[]): string[] => [...new Set(values)];

const decodeBase64 = (value: string): Uint8Array => {
  const normalized = value.trim();
  if (!normalized || normalized.includes(",")) {
    throw new CurriculumDomainError(
      "INVALID_DOCUMENT_CONTENT",
      "Isi dokumen tidak valid."
    );
  }
  try {
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.codePointAt(index) ?? 0;
    }
    return bytes;
  } catch {
    throw new CurriculumDomainError(
      "INVALID_DOCUMENT_CONTENT",
      "Isi dokumen tidak valid."
    );
  }
};

const sha256 = async (bytes: Uint8Array): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const effectiveComponents = (
  courseId: string,
  curriculumCourseId: string,
  defaults: readonly (typeof courseAssessmentDefaults.$inferSelect)[],
  overrides: readonly (typeof curriculumAssessmentOverrides.$inferSelect)[]
): { components: CurriculumAssessmentComponent[]; inherited: boolean } => {
  const overrideRows = overrides.filter(
    (row) => row.curriculumCourseId === curriculumCourseId
  );
  if (overrideRows.length > 0) {
    return {
      components: overrideRows.map((row) => ({
        componentCode: row.componentCode,
        label: row.label,
        weight: row.weight,
      })),
      inherited: false,
    };
  }
  const defaultRows = defaults.filter((row) => row.courseId === courseId);
  return {
    components:
      defaultRows.length > 0
        ? defaultRows.map((row) => ({
            componentCode: row.componentCode,
            label: row.label,
            weight: row.weight,
          }))
        : [...DEFAULT_COURSE_ASSESSMENT_COMPONENTS],
    inherited: true,
  };
};

export const createCurriculumService = ({
  database,
  getFilePolicy,
  now = () => new Date(),
  storage,
}: {
  database: Database;
  getFilePolicy: (category: string) => Promise<{
    allowedMimeTypes: readonly string[];
    maxSizeBytes: number;
  }>;
  now?: () => Date;
  storage?: FileStorage;
}): CurriculumService => {
  const getManagedProgramIds = async (
    actor: CurriculumActor
  ): Promise<string[] | null> => {
    assertCurriculumRole(actor.actorRoles);
    if (
      isSuperadmin(actor.actorRoles) ||
      actor.actorRoles.includes("ADMIN_AKADEMIK")
    ) {
      return null;
    }
    const rows = await database
      .select({ prodiId: programHeads.prodiId })
      .from(programHeads)
      .where(baseReadCondition(actor, now()));
    return unique(rows.map((row) => row.prodiId));
  };

  const ensureReadableHeader = async (
    actor: CurriculumActor,
    curriculumId: string
  ): Promise<CurriculumHeader> => {
    assertCurriculumRole(actor.actorRoles);
    const managedProgramIds = await getManagedProgramIds(actor);
    const conditions = [eq(curricula.id, curriculumId)];
    if (managedProgramIds && managedProgramIds.length === 0) {
      throw new CurriculumDomainError(
        "CURRICULUM_NOT_FOUND",
        "Kurikulum tidak ditemukan."
      );
    }
    if (managedProgramIds) {
      conditions.push(inArray(curricula.studyProgramId, managedProgramIds));
    }
    const [row] = await database
      .select({
        cohort: {
          entryYear: cohorts.entryYear,
          id: cohorts.id,
        },
        curriculum: curricula,
        studyProgram: {
          code: studyPrograms.code,
          id: studyPrograms.id,
          name: studyPrograms.name,
        },
      })
      .from(curricula)
      .innerJoin(studyPrograms, eq(studyPrograms.id, curricula.studyProgramId))
      .innerJoin(cohorts, eq(cohorts.id, curricula.cohortId))
      .where(and(...conditions))
      .limit(1);
    if (!row) {
      throw new CurriculumDomainError(
        "CURRICULUM_NOT_FOUND",
        "Kurikulum tidak ditemukan."
      );
    }
    return row;
  };

  const ensureManageable = (
    actor: CurriculumActor,
    curriculumId: string
  ): Promise<CurriculumHeader> => {
    assertCurriculumManageRole(actor.actorRoles);
    return ensureReadableHeader(actor, curriculumId);
  };

  const list: CurriculumService["list"] = async ({
    actorRoles,
    actorUserId,
    prodiId,
    status,
  }) => {
    const actor = { actorRoles, actorUserId };
    const managedProgramIds = await getManagedProgramIds(actor);
    const conditions = [];
    if (status) {
      conditions.push(eq(curricula.status, status));
    }
    if (prodiId) {
      conditions.push(eq(curricula.studyProgramId, prodiId));
    }
    if (managedProgramIds) {
      if (managedProgramIds.length === 0) {
        return [];
      }
      conditions.push(inArray(curricula.studyProgramId, managedProgramIds));
    }
    const rows = await database
      .select({
        cohort: {
          entryYear: cohorts.entryYear,
          id: cohorts.id,
        },
        curriculum: curricula,
        studyProgram: {
          code: studyPrograms.code,
          id: studyPrograms.id,
          name: studyPrograms.name,
        },
      })
      .from(curricula)
      .innerJoin(studyPrograms, eq(studyPrograms.id, curricula.studyProgramId))
      .innerJoin(cohorts, eq(cohorts.id, curricula.cohortId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(curricula.updatedAt));
    const ids = rows.map((row) => row.curriculum.id);
    const courseRows = ids.length
      ? await database
          .select({ curriculumId: curriculumCourses.curriculumId })
          .from(curriculumCourses)
          .where(inArray(curriculumCourses.curriculumId, ids))
      : [];
    const courseCounts = new Map<string, number>();
    for (const row of courseRows) {
      courseCounts.set(
        row.curriculumId,
        (courseCounts.get(row.curriculumId) ?? 0) + 1
      );
    }
    return rows.map(({ cohort, curriculum, studyProgram }) => ({
      cohort,
      courseCount: courseCounts.get(curriculum.id) ?? 0,
      createdAt: toIso(curriculum.createdAt),
      id: curriculum.id,
      name: curriculum.name,
      status: curriculum.status as CurriculumListItem["status"],
      studyProgram,
      updatedAt: toIso(curriculum.updatedAt),
    }));
  };

  const get: CurriculumService["get"] = async ({
    actorRoles,
    actorUserId,
    curriculumId,
  }) => {
    const header = await ensureReadableHeader(
      { actorRoles, actorUserId },
      curriculumId
    );
    const courseRows = await database
      .select({
        course: courses,
        curriculumCourse: curriculumCourses,
      })
      .from(curriculumCourses)
      .innerJoin(courses, eq(courses.id, curriculumCourses.courseId))
      .where(eq(curriculumCourses.curriculumId, curriculumId))
      .orderBy(curriculumCourses.semester, curriculumCourses.sortOrder);
    const documentRows = await database
      .select({ document: curriculumDocuments, file: fileObjects })
      .from(curriculumDocuments)
      .innerJoin(
        fileObjects,
        eq(fileObjects.id, curriculumDocuments.fileObjectId)
      )
      .where(
        and(
          eq(curriculumDocuments.curriculumId, curriculumId),
          eq(curriculumDocuments.isCurrent, true)
        )
      )
      .orderBy(desc(curriculumDocuments.createdAt));
    const courseIds = unique(
      courseRows.map((row) => row.curriculumCourse.courseId)
    );
    const curriculumCourseIds = courseRows.map(
      (row) => row.curriculumCourse.id
    );
    const defaults = courseIds.length
      ? await database
          .select()
          .from(courseAssessmentDefaults)
          .where(inArray(courseAssessmentDefaults.courseId, courseIds))
      : [];
    const overrides = curriculumCourseIds.length
      ? await database
          .select()
          .from(curriculumAssessmentOverrides)
          .where(
            inArray(
              curriculumAssessmentOverrides.curriculumCourseId,
              curriculumCourseIds
            )
          )
      : [];
    const serializedDocuments: CurriculumDocumentRecord[] = documentRows.map(
      ({ document, file }) => ({
        createdAt: toIso(document.createdAt),
        documentType: document.documentType,
        fileObjectId: file.id,
        filename: file.originalFilename,
        id: document.id,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
      })
    );
    return {
      assessments: courseRows.map(({ course, curriculumCourse }) => ({
        ...effectiveComponents(
          course.id,
          curriculumCourse.id,
          defaults,
          overrides
        ),
        curriculumCourseId: curriculumCourse.id,
      })),
      cohort: header.cohort,
      courses: courseRows.map(({ course, curriculumCourse }) => ({
        courseCode: course.code,
        courseId: course.id,
        courseName: course.name,
        courseType:
          curriculumCourse.courseType as CurriculumCourseInput["courseType"],
        credits: curriculumCourse.credits,
        id: curriculumCourse.id,
        semester: curriculumCourse.semester,
        sortOrder: curriculumCourse.sortOrder,
      })),
      createdAt: toIso(header.curriculum.createdAt),
      documents: serializedDocuments,
      id: header.curriculum.id,
      name: header.curriculum.name,
      status: header.curriculum.status as CurriculumRecord["status"],
      studyProgram: header.studyProgram,
      updatedAt: toIso(header.curriculum.updatedAt),
    };
  };

  const create: CurriculumService["create"] = async ({
    actorRoles,
    actorUserId,
    cohortId,
    name,
    studyProgramId,
  }) => {
    const actor = { actorRoles, actorUserId };
    assertCurriculumManageRole(actorRoles);
    if (!isSuperadmin(actorRoles)) {
      const managedProgramIds = await getManagedProgramIds(actor);
      if (!managedProgramIds?.includes(studyProgramId)) {
        throw new CurriculumDomainError(
          "PRODI_ACCESS_DENIED",
          "Anda hanya dapat mengelola kurikulum pada Prodi yang ditugaskan."
        );
      }
    }
    const [program] = await database
      .select({ id: studyPrograms.id })
      .from(studyPrograms)
      .where(
        and(
          eq(studyPrograms.id, studyProgramId),
          eq(studyPrograms.status, "ACTIVE")
        )
      )
      .limit(1);
    const [cohort] = await database
      .select({ id: cohorts.id, studyProgramId: cohorts.studyProgramId })
      .from(cohorts)
      .where(and(eq(cohorts.id, cohortId), eq(cohorts.status, "ACTIVE")))
      .limit(1);
    if (!program || !cohort || cohort.studyProgramId !== studyProgramId) {
      throw new CurriculumDomainError(
        "INVALID_REFERENCE",
        "Prodi atau angkatan tidak ditemukan atau tidak aktif."
      );
    }
    const normalizedName = normalizeCurriculumName(name);
    const id = crypto.randomUUID();
    const currentTime = now();
    await database.batch([
      database.insert(curricula).values({
        cohortId,
        createdAt: currentTime,
        createdBy: actorUserId,
        id,
        name: normalizedName,
        status: "DRAFT",
        studyProgramId,
        updatedAt: currentTime,
      }),
      database.insert(auditLogs).values({
        action: "CREATE",
        actorUserId,
        afterState: JSON.stringify({
          cohortId,
          name: normalizedName,
          studyProgramId,
        }),
        beforeState: null,
        createdAt: currentTime,
        entityId: id,
        entityType: "CURRICULUM",
        id: crypto.randomUUID(),
        requestId: null,
      }),
    ] as unknown as Parameters<Database["batch"]>[0]);
    return { id };
  };

  const replaceStructure: CurriculumService["replaceStructure"] = async ({
    actorRoles,
    actorUserId,
    courses: inputCourses,
    curriculumId,
  }) => {
    const header = await ensureManageable(
      { actorRoles, actorUserId },
      curriculumId
    );
    if (header.curriculum.status !== "DRAFT") {
      throw new CurriculumDomainError(
        "CURRICULUM_NOT_DRAFT",
        "Struktur hanya dapat diubah pada kurikulum draft."
      );
    }
    const normalizedCourses = validateCurriculumStructure(inputCourses);
    const courseIds = unique(
      normalizedCourses.map((course) => course.courseId)
    );
    const courseRows = courseIds.length
      ? await database
          .select({
            credits: courses.credits,
            id: courses.id,
            studyProgramId: courses.studyProgramId,
          })
          .from(courses)
          .where(
            and(inArray(courses.id, courseIds), eq(courses.status, "ACTIVE"))
          )
      : [];
    const coursesById = new Map(
      courseRows.map((course) => [course.id, course])
    );
    for (const inputCourse of normalizedCourses) {
      const course = coursesById.get(inputCourse.courseId);
      if (
        !course ||
        course.studyProgramId !== header.curriculum.studyProgramId
      ) {
        throw new CurriculumDomainError(
          "INVALID_COURSE_REFERENCE",
          "Mata kuliah harus aktif dan berasal dari Prodi kurikulum."
        );
      }
    }
    const existingRows = await database
      .select({ id: curriculumCourses.id })
      .from(curriculumCourses)
      .where(eq(curriculumCourses.curriculumId, curriculumId));
    const existingIds = existingRows.map((row) => row.id);
    const currentTime = now();
    const statements = [
      ...(existingIds.length
        ? [
            database
              .delete(curriculumAssessmentOverrides)
              .where(
                inArray(
                  curriculumAssessmentOverrides.curriculumCourseId,
                  existingIds
                )
              ),
          ]
        : []),
      database
        .delete(curriculumCourses)
        .where(eq(curriculumCourses.curriculumId, curriculumId)),
      ...(normalizedCourses.length
        ? [
            database.insert(curriculumCourses).values(
              normalizedCourses.map((course, sortOrder) => ({
                courseId: course.courseId,
                courseType: course.courseType,
                createdAt: currentTime,
                credits: coursesById.get(course.courseId)?.credits ?? 0,
                curriculumId,
                id: crypto.randomUUID(),
                semester: course.semester,
                sortOrder,
                updatedAt: currentTime,
              }))
            ),
          ]
        : []),
      database
        .update(curricula)
        .set({ updatedAt: currentTime })
        .where(eq(curricula.id, curriculumId)),
      database.insert(auditLogs).values({
        action: "UPDATE",
        actorUserId,
        afterState: JSON.stringify({ courseCount: normalizedCourses.length }),
        beforeState: JSON.stringify({ courseCount: existingRows.length }),
        createdAt: currentTime,
        entityId: curriculumId,
        entityType: "CURRICULUM_STRUCTURE",
        id: crypto.randomUUID(),
        requestId: null,
      }),
    ];
    await database.batch(
      statements as unknown as Parameters<Database["batch"]>[0]
    );
  };

  const replaceAssessments: CurriculumService["replaceAssessments"] = async ({
    actorRoles,
    actorUserId,
    curriculumId,
    overrides,
  }) => {
    const header = await ensureManageable(
      { actorRoles, actorUserId },
      curriculumId
    );
    if (header.curriculum.status !== "DRAFT") {
      throw new CurriculumDomainError(
        "CURRICULUM_NOT_DRAFT",
        "Komponen nilai hanya dapat diubah pada kurikulum draft."
      );
    }
    const courseRows = await database
      .select({ id: curriculumCourses.id })
      .from(curriculumCourses)
      .where(eq(curriculumCourses.curriculumId, curriculumId));
    const courseIds = new Set(courseRows.map((row) => row.id));
    const currentTime = now();
    const normalizedOverrides = overrides.map((override) => {
      if (!courseIds.has(override.curriculumCourseId)) {
        throw new CurriculumDomainError(
          "INVALID_CURRICULUM_COURSE",
          "Komponen nilai mengacu pada mata kuliah yang tidak ada dalam kurikulum."
        );
      }
      return {
        components: validateAssessmentComponents(override.components),
        curriculumCourseId: override.curriculumCourseId,
      };
    });
    const statements = [
      ...(courseRows.length
        ? [
            database.delete(curriculumAssessmentOverrides).where(
              inArray(
                curriculumAssessmentOverrides.curriculumCourseId,
                courseRows.map((row) => row.id)
              )
            ),
          ]
        : []),
      ...normalizedOverrides.flatMap((override) =>
        override.components.length
          ? [
              database.insert(curriculumAssessmentOverrides).values(
                override.components.map((component) => ({
                  componentCode: component.componentCode,
                  createdAt: currentTime,
                  curriculumCourseId: override.curriculumCourseId,
                  id: crypto.randomUUID(),
                  label: component.label,
                  updatedAt: currentTime,
                  weight: component.weight,
                }))
              ),
            ]
          : []
      ),
      database
        .update(curricula)
        .set({ updatedAt: currentTime })
        .where(eq(curricula.id, curriculumId)),
      database.insert(auditLogs).values({
        action: "UPDATE",
        actorUserId,
        afterState: JSON.stringify({
          overrideCount: normalizedOverrides.length,
        }),
        beforeState: null,
        createdAt: currentTime,
        entityId: curriculumId,
        entityType: "CURRICULUM_ASSESSMENT",
        id: crypto.randomUUID(),
        requestId: null,
      }),
    ];
    await database.batch(
      statements as unknown as Parameters<Database["batch"]>[0]
    );
  };

  const activate: CurriculumService["activate"] = async ({
    actorRoles,
    actorUserId,
    curriculumId,
  }) => {
    const header = await ensureManageable(
      { actorRoles, actorUserId },
      curriculumId
    );
    if (header.curriculum.status !== "DRAFT") {
      throw new CurriculumDomainError(
        "CURRICULUM_NOT_DRAFT",
        "Hanya kurikulum draft yang dapat diaktifkan."
      );
    }
    const current = await get({ actorRoles, actorUserId, curriculumId });
    if (current.courses.length === 0) {
      throw new CurriculumDomainError(
        "CURRICULUM_STRUCTURE_REQUIRED",
        "Struktur mata kuliah wajib diisi sebelum kurikulum diaktifkan."
      );
    }
    for (const assessment of current.assessments) {
      validateAssessmentComponents(assessment.components, true);
    }
    const currentTime = now();
    const statements = [
      database
        .update(curricula)
        .set({ status: "ARCHIVED", updatedAt: currentTime })
        .where(
          and(
            eq(curricula.studyProgramId, header.curriculum.studyProgramId),
            eq(curricula.cohortId, header.curriculum.cohortId),
            eq(curricula.status, "ACTIVE"),
            ne(curricula.id, curriculumId)
          )
        ),
      database
        .update(curricula)
        .set({
          activatedAt: currentTime,
          activatedBy: actorUserId,
          status: "ACTIVE",
          updatedAt: currentTime,
        })
        .where(
          and(eq(curricula.id, curriculumId), eq(curricula.status, "DRAFT"))
        ),
      database.insert(auditLogs).values({
        action: "UPDATE",
        actorUserId,
        afterState: JSON.stringify({ status: "ACTIVE" }),
        beforeState: JSON.stringify({ status: "DRAFT" }),
        createdAt: currentTime,
        entityId: curriculumId,
        entityType: "CURRICULUM",
        id: crypto.randomUUID(),
        requestId: null,
      }),
      database.insert(outboxEvents).values({
        aggregateId: curriculumId,
        aggregateType: "CURRICULUM",
        attempts: 0,
        availableAt: currentTime,
        createdAt: currentTime,
        eventType: "CURRICULUM_ACTIVATED",
        id: crypto.randomUUID(),
        payload: JSON.stringify({ curriculumId }),
        status: "PENDING",
      }),
    ];
    await database.batch(
      statements as unknown as Parameters<Database["batch"]>[0]
    );
    return { status: "ACTIVE" };
  };

  const archive: CurriculumService["archive"] = async ({
    actorRoles,
    actorUserId,
    curriculumId,
  }) => {
    const header = await ensureManageable(
      { actorRoles, actorUserId },
      curriculumId
    );
    if (header.curriculum.status === "ARCHIVED") {
      return;
    }
    const currentTime = now();
    await database.batch([
      database
        .update(curricula)
        .set({ status: "ARCHIVED", updatedAt: currentTime })
        .where(eq(curricula.id, curriculumId)),
      database.insert(auditLogs).values({
        action: "ARCHIVE",
        actorUserId,
        afterState: JSON.stringify({ status: "ARCHIVED" }),
        beforeState: JSON.stringify({ status: header.curriculum.status }),
        createdAt: currentTime,
        entityId: curriculumId,
        entityType: "CURRICULUM",
        id: crypto.randomUUID(),
        requestId: null,
      }),
    ] as unknown as Parameters<Database["batch"]>[0]);
  };

  const uploadDocument: CurriculumService["uploadDocument"] = async ({
    actorRoles,
    actorUserId,
    contentBase64,
    curriculumId,
    declaredMime,
    documentType = "CURRICULUM",
    filename,
    mimeType,
  }) => {
    const header = await ensureManageable(
      { actorRoles, actorUserId },
      curriculumId
    );
    if (header.curriculum.status !== "DRAFT") {
      throw new CurriculumDomainError(
        "CURRICULUM_NOT_DRAFT",
        "Dokumen hanya dapat diganti pada kurikulum draft."
      );
    }
    if (!storage) {
      throw new CurriculumDomainError(
        "STORAGE_UNAVAILABLE",
        "Penyimpanan dokumen belum tersedia."
      );
    }
    const filePolicy = await getFilePolicy("CURRICULUM");
    const bytes = decodeBase64(contentBase64);
    const metadata = validateFileMetadata(
      { declaredMime, filename, mimeType, sizeBytes: bytes.byteLength },
      {
        allowedMimeTypes: filePolicy.allowedMimeTypes,
        maxBytes: filePolicy.maxSizeBytes,
      }
    );
    const fileObjectId = crypto.randomUUID();
    const documentId = crypto.randomUUID();
    const objectKey = createPrivateObjectKey("curriculum", curriculumId);
    const checksum = await sha256(bytes);
    const currentTime = now();
    await uploadWithCompensation(
      storage,
      objectKey,
      bytes,
      async () => {
        await database.batch([
          database
            .update(curriculumDocuments)
            .set({ isCurrent: false })
            .where(
              and(
                eq(curriculumDocuments.curriculumId, curriculumId),
                eq(curriculumDocuments.isCurrent, true)
              )
            ),
          database.insert(fileObjects).values({
            checksum,
            createdAt: currentTime,
            createdBy: actorUserId,
            declaredMime: metadata.declaredMime,
            id: fileObjectId,
            mimeType: metadata.mimeType,
            objectKey,
            originalFilename: metadata.filename,
            ownerId: curriculumId,
            ownerType: "CURRICULUM",
            sizeBytes: metadata.sizeBytes,
            status: "ACTIVE",
          }),
          database.insert(curriculumDocuments).values({
            createdAt: currentTime,
            curriculumId,
            documentType,
            fileObjectId,
            id: documentId,
            isCurrent: true,
          }),
          database
            .update(curricula)
            .set({ updatedAt: currentTime })
            .where(eq(curricula.id, curriculumId)),
          database.insert(auditLogs).values({
            action: "UPDATE",
            actorUserId,
            afterState: JSON.stringify({
              documentId,
              filename: metadata.filename,
            }),
            beforeState: null,
            createdAt: currentTime,
            entityId: curriculumId,
            entityType: "CURRICULUM_DOCUMENT",
            id: crypto.randomUUID(),
            requestId: null,
          }),
        ] as unknown as Parameters<Database["batch"]>[0]);
        return documentId;
      },
      { httpMetadata: { contentType: metadata.mimeType } }
    );
    return { documentId, fileObjectId };
  };

  const downloadDocument: CurriculumService["downloadDocument"] = async ({
    actorRoles,
    actorUserId,
    curriculumId,
  }) => {
    if (!storage) {
      throw new CurriculumDomainError(
        "STORAGE_UNAVAILABLE",
        "Penyimpanan dokumen belum tersedia."
      );
    }
    await ensureReadableHeader({ actorRoles, actorUserId }, curriculumId);
    const [row] = await database
      .select({ file: fileObjects })
      .from(curriculumDocuments)
      .innerJoin(
        fileObjects,
        eq(fileObjects.id, curriculumDocuments.fileObjectId)
      )
      .where(
        and(
          eq(curriculumDocuments.curriculumId, curriculumId),
          eq(curriculumDocuments.isCurrent, true),
          eq(fileObjects.status, "ACTIVE")
        )
      )
      .orderBy(desc(curriculumDocuments.createdAt))
      .limit(1);
    if (!row) {
      throw new CurriculumDomainError(
        "DOCUMENT_NOT_FOUND",
        "Dokumen kurikulum tidak ditemukan."
      );
    }
    const object = await storage.get(row.file.objectKey);
    if (!object) {
      throw new CurriculumDomainError(
        "DOCUMENT_NOT_FOUND",
        "Dokumen kurikulum tidak ditemukan."
      );
    }
    return {
      body: object.body,
      contentType: row.file.mimeType,
      filename: row.file.originalFilename,
    };
  };

  return {
    activate,
    archive,
    create,
    downloadDocument,
    get,
    list,
    replaceAssessments,
    replaceStructure,
    uploadDocument,
  };
};
