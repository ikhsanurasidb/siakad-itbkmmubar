import type {
  GradeClassRecordDetail,
  GradeComponentRecord,
  GradesService,
} from "@siakad-itbkmmubar/api/context";
import {
  calculateFinalGrade,
  calculateStudyResult,
  GradeDomainError,
  assertGradeRole,
  assertGradeTransition,
  gradeStatuses,
  scoreSchema,
} from "@siakad-itbkmmubar/api/grades";
import type {
  GradeStatus,
  PublishedGradeRow,
} from "@siakad-itbkmmubar/api/grades";
import type { RoleKey } from "@siakad-itbkmmubar/api/identity";
import { formatAcademicPeriodTerm } from "@siakad-itbkmmubar/api/master-data";
import type { GradingPolicy } from "@siakad-itbkmmubar/api/settings";
import type { Database } from "@siakad-itbkmmubar/db";
import { courseAssessmentDefaults } from "@siakad-itbkmmubar/db/schema/curriculum";
import {
  classGradeComponents,
  finalGradeSnapshots,
  gradeAdjustments,
  gradePublications,
  gradeSubmissionBatches,
  studentComponentScores,
  studyResultSnapshots,
  transcriptEntries,
} from "@siakad-itbkmmubar/db/schema/grades";
import {
  identityAccounts,
  programHeads,
} from "@siakad-itbkmmubar/db/schema/identity";
import {
  academicPeriods,
  courses,
  students,
  lecturers,
} from "@siakad-itbkmmubar/db/schema/master-data";
import {
  auditLogs,
  backgroundJobs,
  notifications,
} from "@siakad-itbkmmubar/db/schema/platform";
import {
  classEnrollments,
  classSections,
  teachingAssignments,
} from "@siakad-itbkmmubar/db/schema/scheduling";
import { createUuidV7 } from "@siakad-itbkmmubar/uuid";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  max,
  or,
  sql,
} from "drizzle-orm";

/* eslint-disable no-await-in-loop -- Sequential writes preserve grade and job checkpoints. */

const DEFAULT_GRADE_SCALE = [
  {
    gradeCode: "A",
    label: "Sangat baik",
    maxScore: 100,
    minScore: 85,
    qualityPoints: 4,
  },
  {
    gradeCode: "AB",
    label: "Baik sekali",
    maxScore: 84.99,
    minScore: 80,
    qualityPoints: 3.5,
  },
  {
    gradeCode: "B",
    label: "Baik",
    maxScore: 79.99,
    minScore: 70,
    qualityPoints: 3,
  },
  {
    gradeCode: "BC",
    label: "Cukup baik",
    maxScore: 69.99,
    minScore: 65,
    qualityPoints: 2.5,
  },
  {
    gradeCode: "C",
    label: "Cukup",
    maxScore: 64.99,
    minScore: 55,
    qualityPoints: 2,
  },
  {
    gradeCode: "D",
    label: "Kurang",
    maxScore: 54.99,
    minScore: 40,
    qualityPoints: 1,
  },
  {
    gradeCode: "E",
    label: "Tidak lulus",
    maxScore: 39.99,
    minScore: 0,
    qualityPoints: 0,
  },
] as const;

const toHundredths = (value: number): number => Math.round(value * 100);
const fromHundredths = (value: number): number => value / 100;
const nowDefault = (): Date => new Date();

const parseGradeStatus = (value: string): GradeStatus => {
  if (!gradeStatuses.includes(value as GradeStatus)) {
    throw new GradeDomainError(
      "INVALID_GRADE_STATUS",
      "Status nilai tidak valid."
    );
  }
  return value as GradeStatus;
};

const getBatch = async (database: Database, classSectionId: string) => {
  const [batch] = await database
    .select()
    .from(gradeSubmissionBatches)
    .where(eq(gradeSubmissionBatches.classSectionId, classSectionId))
    .orderBy(desc(gradeSubmissionBatches.createdAt))
    .limit(1);
  return batch ?? null;
};

const getClass = async (database: Database, classSectionId: string) => {
  const [row] = await database
    .select({
      academicPeriodId: classSections.academicPeriodId,
      classCode: classSections.code,
      courseCode: courses.code,
      courseId: courses.id,
      courseName: courses.name,
      studyProgramId: classSections.studyProgramId,
    })
    .from(classSections)
    .innerJoin(courses, eq(courses.id, classSections.courseId))
    .where(eq(classSections.id, classSectionId))
    .limit(1);
  if (!row) {
    throw new GradeDomainError(
      "CLASS_NOT_FOUND",
      "Kelas nilai tidak ditemukan."
    );
  }
  return row;
};

const ensureComponents = async (
  database: Database,
  classSectionId: string,
  courseId: string,
  now: () => Date
): Promise<readonly GradeComponentRecord[]> => {
  let components = await database
    .select()
    .from(classGradeComponents)
    .where(eq(classGradeComponents.classSectionId, classSectionId))
    .orderBy(asc(classGradeComponents.sortOrder));
  if (components.length > 0) {
    return components;
  }
  const defaults = await database
    .select()
    .from(courseAssessmentDefaults)
    .where(eq(courseAssessmentDefaults.courseId, courseId))
    .orderBy(asc(courseAssessmentDefaults.createdAt));
  const source = defaults.length
    ? defaults
    : [{ componentCode: "NILAI_AKHIR", label: "Nilai akhir", weight: 100 }];
  await database
    .insert(classGradeComponents)
    .values(
      source.map((component, sortOrder) => ({
        classSectionId,
        componentCode: component.componentCode,
        createdAt: now(),
        id: createUuidV7(),
        label: component.label,
        sortOrder,
        weight: component.weight,
      }))
    )
    .onConflictDoNothing();
  components = await database
    .select()
    .from(classGradeComponents)
    .where(eq(classGradeComponents.classSectionId, classSectionId))
    .orderBy(asc(classGradeComponents.sortOrder));
  return components;
};

export const createGradesService = ({
  database,
  getGradingPolicy,
  now = nowDefault,
}: {
  database: Database;
  getGradingPolicy: (asOf?: Date) => Promise<GradingPolicy>;
  now?: () => Date;
}): GradesService => {
  const assertClassAccess = async (
    classSectionId: string,
    actorRoles: readonly RoleKey[],
    actorUserId: string
  ) => {
    const classRow = await getClass(database, classSectionId);
    if (
      actorRoles.includes("SUPERADMIN") ||
      actorRoles.includes("ADMIN_AKADEMIK")
    ) {
      return classRow;
    }
    if (actorRoles.includes("KAPRODI")) {
      const managed = await database
        .select({ prodiId: programHeads.prodiId })
        .from(programHeads)
        .where(
          and(
            eq(programHeads.userId, actorUserId),
            lte(programHeads.startsAt, now()),
            or(isNull(programHeads.endsAt), gt(programHeads.endsAt, now()))
          )
        );
      if (
        managed.some((program) => program.prodiId === classRow.studyProgramId)
      ) {
        return classRow;
      }
      throw new GradeDomainError(
        "CLASS_ACCESS_DENIED",
        "Kelas ini berada di luar lingkup Prodi Anda."
      );
    }
    assertGradeRole(actorRoles, ["DOSEN"]);
    const [assignment] = await database
      .select({ id: teachingAssignments.id })
      .from(teachingAssignments)
      .innerJoin(lecturers, eq(lecturers.id, teachingAssignments.lecturerId))
      .innerJoin(
        identityAccounts,
        eq(identityAccounts.identifier, lecturers.dsn)
      )
      .where(
        and(
          eq(teachingAssignments.classSectionId, classSectionId),
          eq(identityAccounts.userId, actorUserId)
        )
      )
      .limit(1);
    if (!assignment) {
      throw new GradeDomainError(
        "CLASS_ACCESS_DENIED",
        "Kelas ini bukan kelas yang Anda ampu."
      );
    }
    return classRow;
  };

  const ensureBatch = async (classSectionId: string, actorUserId: string) => {
    const existing = await getBatch(database, classSectionId);
    if (existing) {
      return existing;
    }
    await database.insert(gradeSubmissionBatches).values({
      actorUserId,
      classSectionId,
      id: createUuidV7(),
      status: "DRAFT",
      version: 0,
    });
    const created = await getBatch(database, classSectionId);
    if (!created) {
      throw new GradeDomainError(
        "GRADE_BATCH_UNAVAILABLE",
        "Data nilai belum dapat disiapkan."
      );
    }
    return created;
  };

  const listClasses: GradesService["listClasses"] = async ({
    actorRoles,
    actorUserId,
    academicPeriodId,
  }) => {
    const conditions = academicPeriodId
      ? [eq(classSections.academicPeriodId, academicPeriodId)]
      : [];
    const rows = await database
      .select({
        academicPeriodId: classSections.academicPeriodId,
        classCode: classSections.code,
        classSectionId: classSections.id,
        courseCode: courses.code,
        courseId: courses.id,
        courseName: courses.name,
      })
      .from(classSections)
      .innerJoin(courses, eq(courses.id, classSections.courseId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(courses.code), asc(classSections.code));
    const result: GradeClassRecordDetail[] = [];
    for (const row of rows) {
      try {
        await assertClassAccess(row.classSectionId, actorRoles, actorUserId);
      } catch {
        continue;
      }
      const batch = await ensureBatch(row.classSectionId, actorUserId);
      const [countRow] = await database
        .select({ count: sql<number>`count(*)` })
        .from(classEnrollments)
        .where(eq(classEnrollments.classSectionId, row.classSectionId));
      result.push({
        academicPeriodId: row.academicPeriodId,
        classCode: row.classCode,
        classSectionId: row.classSectionId,
        components: [],
        courseCode: row.courseCode,
        courseId: row.courseId,
        courseName: row.courseName,
        status: parseGradeStatus(batch.status),
        studentCount: Number(countRow?.count ?? 0),
        students: [],
        version: batch.version,
      });
    }
    return result.map(
      ({ components: _components, students: _students, version, ...row }) => ({
        ...row,
        status: row.status,
        studentCount: row.studentCount,
        version,
      })
    );
  };

  const classDetail: GradesService["classDetail"] = async ({
    actorRoles,
    actorUserId,
    classSectionId,
  }) => {
    const classRow = await assertClassAccess(
      classSectionId,
      actorRoles,
      actorUserId
    );
    const batch = await ensureBatch(classSectionId, actorUserId);
    const components = await ensureComponents(
      database,
      classSectionId,
      classRow.courseId,
      now
    );
    const enrolled = await database
      .select({ id: students.id, name: students.name, nim: students.nim })
      .from(classEnrollments)
      .innerJoin(students, eq(students.id, classEnrollments.studentId))
      .where(eq(classEnrollments.classSectionId, classSectionId))
      .orderBy(asc(students.nim));
    const scores = enrolled.length
      ? await database
          .select()
          .from(studentComponentScores)
          .where(
            inArray(
              studentComponentScores.studentId,
              enrolled.map((student) => student.id)
            )
          )
      : [];
    return {
      academicPeriodId: classRow.academicPeriodId,
      classCode: classRow.classCode,
      classSectionId,
      components: components.map(({ componentCode, id, label, weight }) => ({
        componentCode,
        id,
        label,
        weight,
      })),
      courseCode: classRow.courseCode,
      courseId: classRow.courseId,
      courseName: classRow.courseName,
      status: parseGradeStatus(batch.status),
      studentCount: enrolled.length,
      students: enrolled.map((student) => ({
        name: student.name,
        nim: student.nim,
        scores: components.map((component) => {
          const score = scores.find(
            (item) =>
              item.studentId === student.id &&
              item.classGradeComponentId === component.id
          );
          return {
            componentId: component.id,
            score: score ? fromHundredths(score.scoreHundredths) : null,
            version: score?.version ?? 0,
          };
        }),
        studentId: student.id,
      })),
      version: batch.version,
    };
  };

  const saveScores: GradesService["saveScores"] = async ({
    actorRoles,
    actorUserId,
    classSectionId,
    scores,
  }) => {
    await assertClassAccess(classSectionId, actorRoles, actorUserId);
    const batch = await ensureBatch(classSectionId, actorUserId);
    if (batch.status !== "DRAFT") {
      throw new GradeDomainError(
        "GRADE_EDIT_LOCKED",
        "Nilai tidak dapat diubah setelah diajukan."
      );
    }
    const classRow = await getClass(database, classSectionId);
    const componentRows = await ensureComponents(
      database,
      classSectionId,
      classRow.courseId,
      now
    );
    const componentIds = new Set(
      componentRows.map((component) => component.id)
    );
    const enrolled = await database
      .select({ studentId: classEnrollments.studentId })
      .from(classEnrollments)
      .where(eq(classEnrollments.classSectionId, classSectionId));
    const studentIds = new Set(enrolled.map((student) => student.studentId));
    let savedCount = 0;
    for (const input of scores) {
      scoreSchema.parse(input.score);
      if (
        !componentIds.has(input.componentId) ||
        !studentIds.has(input.studentId)
      ) {
        throw new GradeDomainError(
          "SCORE_TARGET_INVALID",
          "Baris nilai tidak sesuai dengan kelas."
        );
      }
      const [existing] = await database
        .select()
        .from(studentComponentScores)
        .where(
          and(
            eq(studentComponentScores.studentId, input.studentId),
            eq(studentComponentScores.classGradeComponentId, input.componentId)
          )
        )
        .limit(1);
      if (existing && existing.version !== input.expectedVersion) {
        throw new GradeDomainError(
          "STALE_GRADE",
          "Nilai berubah di tab lain. Muat ulang sebelum menyimpan."
        );
      }
      if (existing) {
        const [updated] = await database
          .update(studentComponentScores)
          .set({
            scoreHundredths: toHundredths(input.score),
            updatedAt: now(),
            version: existing.version + 1,
          })
          .where(
            and(
              eq(studentComponentScores.id, existing.id),
              eq(studentComponentScores.version, input.expectedVersion)
            )
          )
          .returning({ id: studentComponentScores.id });
        if (!updated) {
          throw new GradeDomainError(
            "STALE_GRADE",
            "Nilai berubah di tab lain. Muat ulang sebelum menyimpan."
          );
        }
      } else {
        if (input.expectedVersion !== 0) {
          throw new GradeDomainError(
            "STALE_GRADE",
            "Nilai belum tersedia pada versi yang diminta."
          );
        }
        await database.insert(studentComponentScores).values({
          classGradeComponentId: input.componentId,
          id: createUuidV7(),
          scoreHundredths: toHundredths(input.score),
          studentId: input.studentId,
          version: 1,
        });
      }
      savedCount += 1;
    }
    return { savedCount };
  };

  const createSnapshots = async ({
    actorUserId,
    classSectionId,
  }: {
    actorUserId: string;
    classSectionId: string;
  }): Promise<void> => {
    const detail = await classDetail({
      actorRoles: ["SUPERADMIN"],
      actorUserId,
      classSectionId,
    });
    const policy = await getGradingPolicy(now());
    const resolvedPolicy = policy.scale.length
      ? policy
      : { ...policy, scale: DEFAULT_GRADE_SCALE };
    const policyVersion = JSON.stringify({
      retakePolicy: resolvedPolicy.retakePolicy,
      roundingMethod: resolvedPolicy.roundingMethod,
      roundingPrecision: resolvedPolicy.roundingPrecision,
      scaleVersionId: resolvedPolicy.scaleVersionId,
    });
    for (const student of detail.students) {
      const calculated = calculateFinalGrade({
        components: detail.components,
        policy: resolvedPolicy,
        scores: student.scores.map((score, index) => ({
          componentCode: detail.components[index]?.componentCode ?? "",
          score: score.score ?? 0,
        })),
      });
      const [latest] = await database
        .select({ attempt: max(finalGradeSnapshots.attempt) })
        .from(finalGradeSnapshots)
        .where(
          and(
            eq(finalGradeSnapshots.classSectionId, classSectionId),
            eq(finalGradeSnapshots.studentId, student.studentId)
          )
        );
      await database.insert(finalGradeSnapshots).values({
        attempt: Number(latest?.attempt ?? 0) + 1,
        classSectionId,
        gradeCode: calculated.gradeCode,
        gradePoint: toHundredths(calculated.gradePoint),
        id: createUuidV7(),
        policyVersion,
        rawScoreHundredths: toHundredths(calculated.rawScore),
        roundedScoreHundredths: toHundredths(calculated.roundedScore),
        scaleVersionId: calculated.scaleVersionId,
        studentId: student.studentId,
        takenAt: now(),
      });
    }
  };

  const transition = async ({
    actorRoles,
    actorUserId,
    classSectionId,
    expectedVersion,
    from,
    to,
  }: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    classSectionId: string;
    expectedVersion: number;
    from: GradeStatus;
    to: GradeStatus;
  }): Promise<void> => {
    await assertClassAccess(classSectionId, actorRoles, actorUserId);
    const batch = await ensureBatch(classSectionId, actorUserId);
    if (
      batch.version !== expectedVersion ||
      parseGradeStatus(batch.status) !== from
    ) {
      throw new GradeDomainError(
        "STALE_GRADE_BATCH",
        "Status nilai berubah. Muat ulang halaman."
      );
    }
    assertGradeTransition(from, to);
    if (to === "LOCKED") {
      await createSnapshots({ actorUserId, classSectionId });
    }
    const [updated] = await database
      .update(gradeSubmissionBatches)
      .set({
        status: to,
        submittedAt: to === "SUBMITTED" ? now() : batch.submittedAt,
        version: batch.version + 1,
      })
      .where(
        and(
          eq(gradeSubmissionBatches.id, batch.id),
          eq(gradeSubmissionBatches.status, from),
          eq(gradeSubmissionBatches.version, expectedVersion)
        )
      )
      .returning({ id: gradeSubmissionBatches.id });
    if (!updated) {
      throw new GradeDomainError(
        "STALE_GRADE_BATCH",
        "Status nilai berubah. Muat ulang halaman."
      );
    }
    await database.insert(auditLogs).values({
      action: "UPDATE",
      actorUserId,
      afterState: JSON.stringify({ status: to }),
      beforeState: JSON.stringify({ status: from }),
      entityId: classSectionId,
      entityType: "GRADE_BATCH",
      id: createUuidV7(),
      metadata: JSON.stringify({ expectedVersion }),
    });
  };

  const submit: GradesService["submit"] = async (input) => {
    const detail = await classDetail(input);
    const policy = await getGradingPolicy(now());
    const resolvedPolicy = policy.scale.length
      ? policy
      : { ...policy, scale: DEFAULT_GRADE_SCALE };
    for (const student of detail.students) {
      calculateFinalGrade({
        components: detail.components,
        policy: resolvedPolicy,
        scores: student.scores.map((score, index) => ({
          componentCode: detail.components[index]?.componentCode ?? "",
          score: score.score ?? Number.NaN,
        })),
      });
    }
    await transition({ ...input, from: "DRAFT", to: "SUBMITTED" });
    return { status: "SUBMITTED" };
  };

  const lock: GradesService["lock"] = async (input) => {
    await transition({ ...input, from: "SUBMITTED", to: "LOCKED" });
    return { status: "LOCKED" };
  };

  const publish: GradesService["publish"] = async ({
    actorRoles,
    actorUserId,
    classSectionId,
    expectedVersion,
  }) => {
    assertGradeRole(actorRoles, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
    const classRow = await getClass(database, classSectionId);
    await transition({
      actorRoles: ["SUPERADMIN"],
      actorUserId,
      classSectionId,
      expectedVersion,
      from: "LOCKED",
      to: "PUBLISHED",
    });
    await database
      .insert(gradePublications)
      .values({
        academicPeriodId: classRow.academicPeriodId,
        classSectionId,
        id: createUuidV7(),
        publishedAt: now(),
        publishedBy: actorUserId,
        status: "COMPLETED",
        version: 1,
      })
      .onConflictDoUpdate({
        set: {
          publishedAt: now(),
          publishedBy: actorUserId,
          status: "COMPLETED",
          version: 1,
        },
        target: [
          gradePublications.classSectionId,
          gradePublications.academicPeriodId,
        ],
      });
    const recipients = await database
      .select({ userId: identityAccounts.userId })
      .from(classEnrollments)
      .innerJoin(students, eq(students.id, classEnrollments.studentId))
      .innerJoin(
        identityAccounts,
        eq(identityAccounts.identifier, students.nim)
      )
      .where(eq(classEnrollments.classSectionId, classSectionId));
    if (recipients.length) {
      await database.insert(notifications).values(
        recipients.map((recipient) => ({
          body: "Nilai kelas Anda sudah resmi diterbitkan.",
          id: createUuidV7(),
          route: "/mahasiswa/nilai",
          title: "Nilai diterbitkan",
          type: "GRADE_PUBLISHED",
          userId: recipient.userId,
        }))
      );
    }
    return { status: "PUBLISHED" as const };
  };

  const reopen: GradesService["reopen"] = async ({
    actorRoles,
    actorUserId,
    classSectionId,
    expectedVersion,
    reason,
  }) => {
    assertGradeRole(actorRoles, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
    const batch = await ensureBatch(classSectionId, actorUserId);
    const currentStatus = parseGradeStatus(batch.status);
    if (currentStatus !== "LOCKED" && currentStatus !== "PUBLISHED") {
      throw new GradeDomainError(
        "INVALID_GRADE_REOPEN",
        "Nilai belum dapat dibuka kembali."
      );
    }
    if (batch.version !== expectedVersion) {
      throw new GradeDomainError(
        "STALE_GRADE_BATCH",
        "Status nilai berubah. Muat ulang halaman."
      );
    }
    if (reason.trim().length < 10) {
      throw new GradeDomainError(
        "GRADE_REOPEN_REASON_REQUIRED",
        "Alasan membuka kembali nilai wajib diisi."
      );
    }
    const snapshots = await database
      .select({ id: finalGradeSnapshots.id })
      .from(finalGradeSnapshots)
      .where(eq(finalGradeSnapshots.classSectionId, classSectionId));
    if (snapshots.length) {
      await database.insert(gradeAdjustments).values(
        snapshots.map((snapshot) => ({
          actorUserId,
          finalGradeSnapshotId: snapshot.id,
          id: createUuidV7(),
          newValue: "REOPENED",
          oldValue: currentStatus,
          reason: reason.trim(),
        }))
      );
    }
    const [updated] = await database
      .update(gradeSubmissionBatches)
      .set({ status: "DRAFT", version: batch.version + 1 })
      .where(
        and(
          eq(gradeSubmissionBatches.id, batch.id),
          eq(gradeSubmissionBatches.version, expectedVersion)
        )
      )
      .returning({ id: gradeSubmissionBatches.id });
    if (!updated) {
      throw new GradeDomainError(
        "STALE_GRADE_BATCH",
        "Status nilai berubah. Muat ulang halaman."
      );
    }
    await database
      .update(gradePublications)
      .set({ status: "PENDING", version: batch.version + 1 })
      .where(eq(gradePublications.classSectionId, classSectionId));
    return { status: "DRAFT" };
  };

  const resolveStudentId = async (actorUserId: string, requested?: string) => {
    const [account] = await database
      .select({ identifier: identityAccounts.identifier })
      .from(identityAccounts)
      .where(eq(identityAccounts.userId, actorUserId))
      .limit(1);
    const [student] = account
      ? await database
          .select({ id: students.id })
          .from(students)
          .where(eq(students.nim, account.identifier))
          .limit(1)
      : [];
    if (!student) {
      throw new GradeDomainError(
        "STUDENT_NOT_FOUND",
        "Data mahasiswa tidak ditemukan."
      );
    }
    if (requested && requested !== student.id) {
      throw new GradeDomainError(
        "GRADE_ACCESS_DENIED",
        "Anda hanya dapat melihat hasil studi sendiri."
      );
    }
    return student.id;
  };

  const loadPublishedRows = async (
    studentId: string
  ): Promise<{
    coursesById: ReadonlyMap<
      string,
      { code: string; credits: number; name: string }
    >;
    periodsById: ReadonlyMap<string, { id: string; term: string }>;
    rows: readonly PublishedGradeRow[];
  }> => {
    const rows = await database
      .select({
        academicPeriodId: academicPeriods.id,
        academicPeriodTerm: academicPeriods.term,
        attempt: finalGradeSnapshots.attempt,
        courseCode: courses.code,
        courseCredits: courses.credits,
        courseId: courses.id,
        courseName: courses.name,
        gradeCode: finalGradeSnapshots.gradeCode,
        gradePoint: finalGradeSnapshots.gradePoint,
        roundedScoreHundredths: finalGradeSnapshots.roundedScoreHundredths,
        snapshotId: finalGradeSnapshots.id,
        studentId: finalGradeSnapshots.studentId,
        takenAt: finalGradeSnapshots.takenAt,
      })
      .from(finalGradeSnapshots)
      .innerJoin(
        classSections,
        eq(classSections.id, finalGradeSnapshots.classSectionId)
      )
      .innerJoin(courses, eq(courses.id, classSections.courseId))
      .innerJoin(
        gradePublications,
        eq(gradePublications.classSectionId, classSections.id)
      )
      .innerJoin(
        academicPeriods,
        eq(academicPeriods.id, gradePublications.academicPeriodId)
      )
      .where(
        and(
          eq(finalGradeSnapshots.studentId, studentId),
          eq(gradePublications.status, "COMPLETED")
        )
      )
      .orderBy(desc(finalGradeSnapshots.takenAt));
    const coursesById = new Map(
      rows.map((row) => [
        row.courseId,
        {
          code: row.courseCode,
          credits: row.courseCredits,
          name: row.courseName,
        },
      ])
    );
    const periodsById = new Map(
      rows.map((row) => [
        row.academicPeriodId,
        { id: row.academicPeriodId, term: row.academicPeriodTerm },
      ])
    );
    return {
      coursesById,
      periodsById,
      rows: rows.map((row) => ({
        academicPeriodId: row.academicPeriodId,
        attempt: row.attempt,
        courseId: row.courseId,
        credits: row.courseCredits,
        gradeCode: row.gradeCode,
        gradePoint: fromHundredths(row.gradePoint),
        roundedScoreHundredths: row.roundedScoreHundredths,
        snapshotId: row.snapshotId,
        studentId: row.studentId,
        takenAt: row.takenAt.toISOString(),
      })),
    };
  };

  const persistPeriodSnapshot = async ({
    periodId,
    policy,
    result,
    rows,
    studentId,
  }: {
    periodId: string;
    policy: GradingPolicy;
    result: ReturnType<typeof calculateStudyResult>;
    rows: readonly PublishedGradeRow[];
    studentId: string;
  }): Promise<void> => {
    const [existing] = await database
      .select({ id: studyResultSnapshots.id })
      .from(studyResultSnapshots)
      .where(
        and(
          eq(studyResultSnapshots.studentId, studentId),
          eq(studyResultSnapshots.academicPeriodId, periodId)
        )
      )
      .limit(1);
    if (existing) {
      await database
        .delete(transcriptEntries)
        .where(eq(transcriptEntries.studyResultSnapshotId, existing.id));
      await database
        .delete(studyResultSnapshots)
        .where(eq(studyResultSnapshots.id, existing.id));
    }
    const snapshotId = createUuidV7();
    const policyVersion = JSON.stringify({
      retakePolicy: policy.retakePolicy,
      roundingMethod: policy.roundingMethod,
      roundingPrecision: policy.roundingPrecision,
      scaleVersionId: policy.scaleVersionId,
    });
    await database.insert(studyResultSnapshots).values({
      academicPeriodId: periodId,
      countedCredits: result.countedCredits,
      countedQualityPointsHundredths: toHundredths(result.countedQualityPoints),
      id: snapshotId,
      ipkHundredths: toHundredths(result.ipk),
      ipsHundredths: toHundredths(result.ips),
      policyVersion,
      retakePolicy: policy.retakePolicy,
      studentId,
    });
    const periodRows = result.selected.filter(
      (row) => row.academicPeriodId === periodId
    );
    const transcriptRows = periodRows.flatMap((row) => {
      const snapshot = rows.find(
        (candidate) =>
          candidate.courseId === row.courseId &&
          candidate.attempt === row.attempt &&
          candidate.academicPeriodId === periodId
      );
      return snapshot?.snapshotId
        ? [
            {
              academicPeriodId: periodId,
              attempt: row.attempt,
              courseId: row.courseId,
              credits: row.credits,
              finalGradeSnapshotId: snapshot.snapshotId,
              gradeCode: snapshot.gradeCode ?? "-",
              gradePointHundredths: toHundredths(row.gradePoint),
              id: createUuidV7(),
              studentId,
              studyResultSnapshotId: snapshotId,
            },
          ]
        : [];
    });
    if (transcriptRows.length) {
      await database.insert(transcriptEntries).values(transcriptRows);
    }
  };

  const studentKhs: GradesService["studentKhs"] = async ({
    academicPeriodId,
    actorRoles,
    actorUserId,
    studentId: requestedStudentId,
  }) => {
    if (requestedStudentId && !actorRoles.includes("MAHASISWA")) {
      assertGradeRole(actorRoles, ["SUPERADMIN", "ADMIN_AKADEMIK", "KAPRODI"]);
    }
    const studentId = actorRoles.includes("MAHASISWA")
      ? await resolveStudentId(actorUserId, requestedStudentId)
      : (requestedStudentId ?? (await resolveStudentId(actorUserId)));
    const loaded = await loadPublishedRows(studentId);
    const periodId = academicPeriodId ?? loaded.rows[0]?.academicPeriodId;
    if (!periodId) {
      throw new GradeDomainError(
        "KHS_NOT_FOUND",
        "Belum ada nilai resmi untuk mahasiswa ini."
      );
    }
    const policy = await getGradingPolicy(now());
    const result = calculateStudyResult({
      allPublished: loaded.rows,
      currentPeriodId: periodId,
      retakePolicy: policy.retakePolicy,
    });
    await persistPeriodSnapshot({
      periodId,
      policy,
      result,
      rows: loaded.rows,
      studentId,
    });
    const entries = result.selected
      .filter((row) => row.academicPeriodId === periodId)
      .map((row) => {
        const course = loaded.coursesById.get(row.courseId);
        const source = loaded.rows.find(
          (candidate) =>
            candidate.courseId === row.courseId &&
            candidate.academicPeriodId === periodId
        );
        return {
          courseCode: course?.code ?? row.courseId,
          courseName: course?.name ?? row.courseId,
          credits: row.credits,
          gradeCode: source?.gradeCode ?? "-",
          gradePoint: row.gradePoint,
          roundedScore: fromHundredths(source?.roundedScoreHundredths ?? 0),
        };
      });
    return {
      academicPeriodId: periodId,
      academicPeriodLabel: formatAcademicPeriodTerm(
        loaded.periodsById.get(periodId)?.term ?? periodId
      ),
      entries,
      ipk: result.ipk,
      ips: result.ips,
      periodId,
    };
  };

  const studentTranscript: GradesService["studentTranscript"] = async ({
    actorRoles,
    actorUserId,
    studentId: requestedStudentId,
  }) => {
    const studentId = actorRoles.includes("MAHASISWA")
      ? await resolveStudentId(actorUserId, requestedStudentId)
      : (requestedStudentId ?? (await resolveStudentId(actorUserId)));
    const loaded = await loadPublishedRows(studentId);
    const policy = await getGradingPolicy(now());
    const result = calculateStudyResult({
      allPublished: loaded.rows,
      retakePolicy: policy.retakePolicy,
    });
    const entries = result.selected.map((row) => {
      const course = loaded.coursesById.get(row.courseId);
      const source = loaded.rows.find(
        (candidate) =>
          candidate.courseId === row.courseId &&
          candidate.attempt === row.attempt
      );
      return {
        courseCode: course?.code ?? row.courseId,
        courseName: course?.name ?? row.courseId,
        credits: row.credits,
        gradeCode: source?.gradeCode ?? "-",
        gradePoint: row.gradePoint,
        roundedScore: fromHundredths(source?.roundedScoreHundredths ?? 0),
      };
    });
    return { entries, ipk: result.ipk };
  };

  const publishPeriod: GradesService["publishPeriod"] = async ({
    academicPeriodId,
    actorRoles,
    actorUserId,
    idempotencyKey,
  }) => {
    assertGradeRole(actorRoles, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
    const key = idempotencyKey ?? `publish:${academicPeriodId}`;
    const [existing] = await database
      .select()
      .from(backgroundJobs)
      .where(
        and(
          eq(backgroundJobs.jobType, "GRADE_PUBLICATION"),
          eq(backgroundJobs.idempotencyKey, key)
        )
      )
      .limit(1);
    const jobId = existing?.id ?? createUuidV7();
    if (!existing) {
      await database.insert(backgroundJobs).values({
        id: jobId,
        idempotencyKey: key,
        jobType: "GRADE_PUBLICATION",
        status: "RUNNING",
      });
    }
    const classes = await listClasses({
      academicPeriodId,
      actorRoles: ["SUPERADMIN"],
      actorUserId,
    });
    let completedCount = existing?.completedCount ?? 0;
    for (const gradeClass of classes) {
      const batch = await getBatch(database, gradeClass.classSectionId);
      if (batch?.status === "LOCKED") {
        await publish({
          actorRoles: ["SUPERADMIN", "ADMIN_AKADEMIK"],
          actorUserId,
          classSectionId: gradeClass.classSectionId,
          expectedVersion: batch.version,
        });
        completedCount += 1;
      }
      await database
        .update(backgroundJobs)
        .set({
          completedCount,
          cursor: gradeClass.classSectionId,
          processedCount: completedCount,
          status: "RUNNING",
          updatedAt: now(),
        })
        .where(eq(backgroundJobs.id, jobId));
    }
    await database
      .update(backgroundJobs)
      .set({
        completedCount,
        processedCount: classes.length,
        status: "COMPLETED",
        updatedAt: now(),
      })
      .where(eq(backgroundJobs.id, jobId));
    return { completedCount, jobId, status: "COMPLETED" };
  };

  return {
    classDetail,
    listClasses,
    lock,
    publish,
    publishPeriod,
    reopen,
    saveScores,
    studentKhs,
    studentTranscript,
    submit,
  };
};
