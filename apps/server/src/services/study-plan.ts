import type { StudyPlanService } from "@api/context";
import type { RoleKey } from "@api/identity";
import type { StudentAcademicStatus } from "@api/master-data";
import {
  getStudyPlanFailureAction,
  StudyPlanDomainError,
  assertStudyPlanManageRole,
  assertStudyPlanReadRole,
  calculateStudyPlanTotals,
  deriveStudentSemester,
  filterCoursesForSemester,
  normalizeStudyPlanReason,
  studyPlanFailureReasonCodes,
  studyPlanStrategies,
} from "@api/study-plan";
import type {
  StudyPlanFailure,
  StudyPlanFailureReasonCode,
  StudyPlanListItem,
  StudyPlanRecord,
  StudyPlanStatus,
  StudentSemesterTrackerRecord,
} from "@api/study-plan";
import { chunkByParameterBudget } from "@db/atomic-batch";
import type { Database } from "@db/index";
import { curricula, curriculumCourses } from "@db/schema/curriculum";
import { identityAccounts, programHeads } from "@db/schema/identity";
import {
  academicPeriods,
  academicYears,
  academicStatuses as studentAcademicStatuses,
  cohorts,
  courses,
  students,
} from "@db/schema/master-data";
import { auditLogs } from "@db/schema/platform";
import { studentSemesterTrackers } from "@db/schema/student-progress";
import {
  studyPlanGenerationJobs,
  studyPlanHistories,
  studyPlanItems,
  studyPlans,
} from "@db/schema/study-plan";
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
  or,
  sql,
} from "drizzle-orm";

const GENERATION_CHUNK_SIZE = 25;
const STUDY_PLAN_ITEM_PARAMETERS = 8;
const STUDENT_SEMESTER_TRACKER_PARAMETERS = 5;

interface StudyPlanActor {
  actorRoles: readonly RoleKey[];
  actorUserId: string;
}

interface StudentCandidate {
  cohortId: string;
  id: string;
  name: string;
  nim: string;
  studyProgramId: string;
}

interface GenerationCourse {
  courseId: string;
  courseCode: string;
  courseStatus: string;
  credits: number;
  curriculumCourseId: string;
  semester: number;
  sortOrder: number;
}

interface GenerationProgress {
  completedCount: number;
  failures: StudyPlanFailure[];
  processedCount: number;
}

interface GenerationPeriod {
  academicYearStartYear: number;
  term: string;
}

type GenerationStudent = Pick<
  StudentCandidate,
  "cohortId" | "id" | "name" | "nim" | "studyProgramId"
>;

const toIso = (value: Date): string => value.toISOString();

const isStudyPlanFailureReasonCode = (
  value: unknown
): value is StudyPlanFailureReasonCode =>
  typeof value === "string" &&
  studyPlanFailureReasonCodes.includes(value as StudyPlanFailureReasonCode);

const isSuperadmin = (roles: readonly RoleKey[]): boolean =>
  roles.includes("SUPERADMIN");

const isAcademicAdmin = (roles: readonly RoleKey[]): boolean =>
  roles.includes("ADMIN_AKADEMIK");

const asTrackerSource = (value: string): "AUTO" | "MANUAL" =>
  value === "MANUAL" ? "MANUAL" : "AUTO";

const asStudentAcademicStatus = (value: string): StudentAcademicStatus =>
  studentAcademicStatuses.includes(
    value as (typeof studentAcademicStatuses)[number]
  )
    ? (value as StudentAcademicStatus)
    : "INACTIVE";

const parseFailures = (value: string | null): StudyPlanFailure[] => {
  if (!value) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.flatMap((item): StudyPlanFailure[] => {
      if (!item || typeof item !== "object") {
        return [];
      }
      const record = item as Record<string, unknown>;
      if (
        typeof record.message !== "string" ||
        typeof record.nim !== "string" ||
        typeof record.studentId !== "string" ||
        !isStudyPlanFailureReasonCode(record.reasonCode)
      ) {
        return [];
      }
      return [
        {
          action:
            typeof record.action === "string"
              ? record.action
              : getStudyPlanFailureAction(record.reasonCode),
          message: record.message,
          nim: record.nim,
          reasonCode: record.reasonCode,
          studentId: record.studentId,
        },
      ];
    });
  } catch {
    return [];
  }
};

const validateGenerationCourses = ({
  courses: generationCourses,
  student,
}: {
  courses: readonly GenerationCourse[];
  student: GenerationStudent;
}): StudyPlanFailure | null => {
  if (generationCourses.length === 0) {
    return {
      action: getStudyPlanFailureAction("CURRICULUM_EMPTY"),
      message: "Kurikulum aktif belum memiliki mata kuliah.",
      nim: student.nim,
      reasonCode: "CURRICULUM_EMPTY",
      studentId: student.id,
    };
  }

  const courseIds = new Set<string>();
  for (const course of generationCourses) {
    if (courseIds.has(course.courseId)) {
      return {
        action: getStudyPlanFailureAction("CURRICULUM_DUPLICATE_COURSE"),
        message: `Mata kuliah ${course.courseCode} tercantum lebih dari sekali pada kurikulum aktif.`,
        nim: student.nim,
        reasonCode: "CURRICULUM_DUPLICATE_COURSE",
        studentId: student.id,
      };
    }
    courseIds.add(course.courseId);

    if (
      !Number.isInteger(course.semester) ||
      course.semester < 1 ||
      course.semester > 8 ||
      !Number.isInteger(course.credits) ||
      course.credits < 1 ||
      course.credits > 6
    ) {
      return {
        action: getStudyPlanFailureAction("CURRICULUM_COURSE_INVALID"),
        message: `Data mata kuliah ${course.courseCode} memiliki semester atau SKS yang tidak valid.`,
        nim: student.nim,
        reasonCode: "CURRICULUM_COURSE_INVALID",
        studentId: student.id,
      };
    }

    if (course.courseStatus !== "ACTIVE") {
      return {
        action: getStudyPlanFailureAction("CURRICULUM_COURSE_INACTIVE"),
        message: `Mata kuliah ${course.courseCode} tidak berstatus aktif.`,
        nim: student.nim,
        reasonCode: "CURRICULUM_COURSE_INACTIVE",
        studentId: student.id,
      };
    }
  }

  return null;
};

const asStatus = (value: string): StudyPlanStatus => {
  if (value !== "DRAFT" && value !== "FINAL") {
    throw new StudyPlanDomainError(
      "INVALID_STUDY_PLAN_STATUS",
      "Status KRS tidak valid."
    );
  }
  return value;
};

const saveGenerationProgress = async ({
  database,
  jobId,
  progress,
  studentId,
  now,
}: {
  database: Database;
  jobId: string;
  now: () => Date;
  progress: GenerationProgress;
  studentId: string;
}): Promise<void> => {
  await database
    .update(studyPlanGenerationJobs)
    .set({
      checkpointStudentId: studentId,
      completedCount: progress.completedCount,
      errorCount: progress.failures.length,
      failureDetails: JSON.stringify(progress.failures),
      processedCount: progress.processedCount,
      updatedAt: now(),
    })
    .where(eq(studyPlanGenerationJobs.id, jobId));
};

const processGenerationStudent = async ({
  academicPeriodId,
  actorUserId,
  coursesByCurriculum,
  curriculumByPair,
  database,
  jobId,
  now,
  studentSemester,
  student,
}: {
  academicPeriodId: string;
  actorUserId: string;
  coursesByCurriculum: ReadonlyMap<string, readonly GenerationCourse[]>;
  curriculumByPair: ReadonlyMap<string, typeof curricula.$inferSelect>;
  database: Database;
  jobId: string;
  now: () => Date;
  studentSemester: number | null;
  student: GenerationStudent;
}): Promise<{ completed: boolean; failure: StudyPlanFailure | null }> => {
  try {
    const [existingPlan] = await database
      .select()
      .from(studyPlans)
      .where(
        and(
          eq(studyPlans.studentId, student.id),
          eq(studyPlans.academicPeriodId, academicPeriodId)
        )
      )
      .limit(1);
    if (existingPlan?.status === "FINAL") {
      return { completed: true, failure: null };
    }
    if (studentSemester === null) {
      return {
        completed: false,
        failure: {
          action: getStudyPlanFailureAction("SEMESTER_TRACKER_UNAVAILABLE"),
          message: "Semester berjalan mahasiswa belum dapat ditentukan.",
          nim: student.nim,
          reasonCode: "SEMESTER_TRACKER_UNAVAILABLE",
          studentId: student.id,
        },
      };
    }
    const curriculum = curriculumByPair.get(
      `${student.studyProgramId}:${student.cohortId}`
    );
    if (!curriculum) {
      return {
        completed: false,
        failure: {
          action: getStudyPlanFailureAction("CURRICULUM_NOT_FOUND"),
          message: "Kurikulum aktif untuk Prodi dan angkatan tidak ditemukan.",
          nim: student.nim,
          reasonCode: "CURRICULUM_NOT_FOUND",
          studentId: student.id,
        },
      };
    }
    const generationCourses = coursesByCurriculum.get(curriculum.id) ?? [];
    const courseFailure = validateGenerationCourses({
      courses: generationCourses,
      student,
    });
    if (courseFailure) {
      return { completed: false, failure: courseFailure };
    }
    const semesterCourses = filterCoursesForSemester(
      generationCourses,
      studentSemester
    );
    if (semesterCourses.length === 0) {
      return {
        completed: false,
        failure: {
          action: getStudyPlanFailureAction("CURRICULUM_SEMESTER_EMPTY"),
          message: `Kurikulum aktif belum memiliki mata kuliah untuk semester berjalan ${studentSemester}.`,
          nim: student.nim,
          reasonCode: "CURRICULUM_SEMESTER_EMPTY",
          studentId: student.id,
        },
      };
    }
    const items = studyPlanStrategies.PACKAGE.generate({
      courses: semesterCourses,
    });
    const totals = calculateStudyPlanTotals(items);
    let planId = existingPlan?.id;
    const mutationStatements: unknown[] = [];
    if (planId) {
      mutationStatements.push(
        database
          .delete(studyPlanItems)
          .where(eq(studyPlanItems.studyPlanId, planId)),
        database
          .update(studyPlans)
          .set({
            curriculumId: curriculum.id,
            totalCourses: totals.totalCourses,
            totalCredits: totals.totalCredits,
            updatedAt: now(),
            version: (existingPlan?.version ?? 0) + 1,
          })
          .where(eq(studyPlans.id, planId))
      );
    } else {
      planId = createUuidV7();
      mutationStatements.push(
        database.insert(studyPlans).values({
          academicPeriodId,
          curriculumId: curriculum.id,
          id: planId,
          mode: "PACKAGE",
          status: "DRAFT",
          studentId: student.id,
          totalCourses: totals.totalCourses,
          totalCredits: totals.totalCredits,
        })
      );
    }
    if (items.length > 0) {
      const itemChunks = chunkByParameterBudget(items, {
        parametersPerRow: STUDY_PLAN_ITEM_PARAMETERS,
      });
      for (const itemChunk of itemChunks) {
        mutationStatements.push(
          database.insert(studyPlanItems).values(
            itemChunk.map((item) => ({
              courseId: item.courseId,
              credits: item.credits,
              curriculumCourseId: item.curriculumCourseId,
              id: createUuidV7(),
              semester: item.semester,
              sortOrder: item.sortOrder,
              source: item.source,
              studyPlanId: planId,
            }))
          )
        );
      }
    }
    mutationStatements.push(
      database.insert(studyPlanHistories).values({
        action: "GENERATE",
        actorUserId,
        fromStatus: existingPlan?.status ?? null,
        id: createUuidV7(),
        metadata: JSON.stringify({ jobId }),
        studyPlanId: planId,
        toStatus: "DRAFT",
      })
    );
    await database.batch(
      mutationStatements as unknown as Parameters<Database["batch"]>[0]
    );
    return { completed: true, failure: null };
  } catch {
    return {
      completed: false,
      failure: {
        action: getStudyPlanFailureAction("GENERATION_FAILED"),
        message: "KRS gagal disimpan karena terjadi konflik pada data KRS.",
        nim: student.nim,
        reasonCode: "GENERATION_FAILED",
        studentId: student.id,
      },
    };
  }
};

const processGenerationPage = async ({
  academicPeriodId,
  actorUserId,
  database,
  jobId,
  now,
  page,
  period,
  progress,
}: {
  academicPeriodId: string;
  actorUserId: string;
  database: Database;
  jobId: string;
  now: () => Date;
  page: readonly GenerationStudent[];
  period: GenerationPeriod;
  progress: GenerationProgress;
}): Promise<void> => {
  const programIds = [
    ...new Set(page.map((student) => student.studyProgramId)),
  ];
  const cohortIds = [...new Set(page.map((student) => student.cohortId))];
  const curriculumRows = await database
    .select({ curriculum: curricula })
    .from(curricula)
    .where(
      and(
        eq(curricula.status, "ACTIVE"),
        inArray(curricula.studyProgramId, programIds),
        inArray(curricula.cohortId, cohortIds)
      )
    )
    .orderBy(desc(curricula.updatedAt));
  const curriculumByPair = new Map<string, typeof curricula.$inferSelect>();
  for (const row of curriculumRows) {
    const pair = `${row.curriculum.studyProgramId}:${row.curriculum.cohortId}`;
    if (!curriculumByPair.has(pair)) {
      curriculumByPair.set(pair, row.curriculum);
    }
  }
  const curriculumIds = [
    ...new Set(curriculumRows.map((row) => row.curriculum.id)),
  ];
  const curriculumCourseRows = curriculumIds.length
    ? await database
        .select({ course: courses, curriculumCourse: curriculumCourses })
        .from(curriculumCourses)
        .innerJoin(courses, eq(courses.id, curriculumCourses.courseId))
        .where(inArray(curriculumCourses.curriculumId, curriculumIds))
        .orderBy(
          asc(curriculumCourses.semester),
          asc(curriculumCourses.sortOrder)
        )
    : [];
  const coursesByCurriculum = new Map<string, GenerationCourse[]>();
  for (const row of curriculumCourseRows) {
    const items =
      coursesByCurriculum.get(row.curriculumCourse.curriculumId) ?? [];
    items.push({
      courseCode: row.course.code,
      courseId: row.curriculumCourse.courseId,
      courseStatus: row.course.status,
      credits: row.curriculumCourse.credits,
      curriculumCourseId: row.curriculumCourse.id,
      semester: row.curriculumCourse.semester,
      sortOrder: row.curriculumCourse.sortOrder,
    });
    coursesByCurriculum.set(row.curriculumCourse.curriculumId, items);
  }

  const studentIds = page.map((student) => student.id);
  const existingTrackerRows = await database
    .select()
    .from(studentSemesterTrackers)
    .where(
      and(
        eq(studentSemesterTrackers.academicPeriodId, academicPeriodId),
        inArray(studentSemesterTrackers.studentId, studentIds)
      )
    );
  const trackerByStudent = new Map(
    existingTrackerRows.map((row) => [row.studentId, row])
  );
  const cohortRows = await database
    .select({ entryYear: cohorts.entryYear, id: cohorts.id })
    .from(cohorts)
    .where(inArray(cohorts.id, cohortIds));
  const entryYearByCohort = new Map(
    cohortRows.map((row) => [row.id, row.entryYear])
  );
  const missingTrackerRows = page.flatMap((student) => {
    if (trackerByStudent.has(student.id)) {
      return [];
    }
    const entryYear = entryYearByCohort.get(student.cohortId);
    const semesterNumber =
      entryYear === undefined
        ? null
        : deriveStudentSemester({
            academicYearStartYear: period.academicYearStartYear,
            cohortEntryYear: entryYear,
            term: period.term,
          });
    return semesterNumber === null
      ? []
      : [
          {
            academicPeriodId,
            id: createUuidV7(),
            semesterNumber,
            source: "AUTO",
            studentId: student.id,
          },
        ];
  });
  const trackerChunks = chunkByParameterBudget(missingTrackerRows, {
    parametersPerRow: STUDENT_SEMESTER_TRACKER_PARAMETERS,
  });
  await Promise.all(
    trackerChunks.map((trackerChunk) =>
      database
        .insert(studentSemesterTrackers)
        .values(trackerChunk)
        .onConflictDoNothing()
    )
  );
  if (missingTrackerRows.length > 0) {
    const persistedTrackerRows = await database
      .select()
      .from(studentSemesterTrackers)
      .where(
        and(
          eq(studentSemesterTrackers.academicPeriodId, academicPeriodId),
          inArray(studentSemesterTrackers.studentId, studentIds)
        )
      );
    trackerByStudent.clear();
    for (const row of persistedTrackerRows) {
      trackerByStudent.set(row.studentId, row);
    }
  }

  for (const student of page) {
    // The checkpoint must advance in student order so a retry cannot skip a row.
    // eslint-disable-next-line no-await-in-loop
    const result = await processGenerationStudent({
      academicPeriodId,
      actorUserId,
      coursesByCurriculum,
      curriculumByPair,
      database,
      jobId,
      now,
      student,
      studentSemester:
        trackerByStudent.get(student.id)?.semesterNumber ??
        (() => {
          const entryYear = entryYearByCohort.get(student.cohortId);
          return entryYear === undefined
            ? null
            : deriveStudentSemester({
                academicYearStartYear: period.academicYearStartYear,
                cohortEntryYear: entryYear,
                term: period.term,
              });
        })(),
    });
    if (result.failure) {
      progress.failures.push(result.failure);
    }
    progress.processedCount += 1;
    if (result.completed) {
      progress.completedCount += 1;
    }
    // Persist after every row so a Worker timeout can resume from the last row.
    // eslint-disable-next-line no-await-in-loop
    await saveGenerationProgress({
      database,
      jobId,
      now,
      progress,
      studentId: student.id,
    });
  }
};

const buildGenerationConditions = ({
  cohortId,
  prodiId,
}: {
  cohortId?: string;
  prodiId?: string;
}) => {
  const conditions = [
    eq(students.status, "ACTIVE"),
    eq(students.academicStatus, "ACTIVE"),
  ];
  if (prodiId) {
    conditions.push(eq(students.studyProgramId, prodiId));
  }
  if (cohortId) {
    conditions.push(eq(students.cohortId, cohortId));
  }
  return conditions;
};

const initializeGenerationJob = async ({
  academicPeriodId,
  actorUserId,
  database,
  existingJob,
  idempotencyKey,
  conditions,
}: {
  academicPeriodId: string;
  actorUserId: string;
  conditions: ReturnType<typeof buildGenerationConditions>;
  database: Database;
  existingJob: typeof studyPlanGenerationJobs.$inferSelect | undefined;
  idempotencyKey: string;
}): Promise<{
  job: typeof studyPlanGenerationJobs.$inferSelect;
  totalCount: number;
}> => {
  const [countRow] = await database
    .select({ count: sql<number>`count(*)` })
    .from(students)
    .where(and(...conditions));
  const totalCount = countRow?.count ? Number(countRow.count) : 0;
  const jobId = existingJob?.id ?? createUuidV7();
  if (!existingJob) {
    await database
      .insert(studyPlanGenerationJobs)
      .values({
        academicPeriodId,
        createdBy: actorUserId,
        id: jobId,
        idempotencyKey,
        mode: "PACKAGE",
        status: "PENDING",
        totalCount,
      })
      .onConflictDoNothing();
  }
  const [job] = await database
    .select()
    .from(studyPlanGenerationJobs)
    .where(eq(studyPlanGenerationJobs.id, jobId))
    .limit(1);
  if (!job) {
    throw new StudyPlanDomainError(
      "GENERATION_JOB_UNAVAILABLE",
      "Pembuatan job KRS belum dapat dimulai."
    );
  }
  return { job, totalCount };
};

const runGenerationJob = async ({
  actorUserId,
  conditions,
  database,
  job,
  now,
  period,
}: {
  actorUserId: string;
  conditions: ReturnType<typeof buildGenerationConditions>;
  database: Database;
  job: typeof studyPlanGenerationJobs.$inferSelect;
  now: () => Date;
  period: GenerationPeriod;
}): Promise<GenerationProgress> => {
  const progress: GenerationProgress = {
    completedCount: job.completedCount,
    failures: parseFailures(job.failureDetails),
    processedCount: job.processedCount,
  };
  let cursor: string | undefined = job.checkpointStudentId ?? undefined;
  await database
    .update(studyPlanGenerationJobs)
    .set({ status: "RUNNING", updatedAt: now() })
    .where(eq(studyPlanGenerationJobs.id, job.id));

  while (true) {
    const pageConditions = cursor
      ? [...conditions, gt(students.id, cursor)]
      : conditions;
    // Pages are intentionally processed serially to preserve the durable checkpoint.
    // eslint-disable-next-line no-await-in-loop
    const page = await database
      .select({
        cohortId: students.cohortId,
        id: students.id,
        name: students.name,
        nim: students.nim,
        studyProgramId: students.studyProgramId,
      })
      .from(students)
      .where(and(...pageConditions))
      .orderBy(asc(students.id))
      .limit(GENERATION_CHUNK_SIZE);
    if (page.length === 0) {
      break;
    }
    // Each page advances only after all its rows are saved.
    // eslint-disable-next-line no-await-in-loop
    await processGenerationPage({
      academicPeriodId: job.academicPeriodId,
      actorUserId,
      database,
      jobId: job.id,
      now,
      page,
      period,
      progress,
    });
    cursor = page.at(-1)?.id;
  }
  return progress;
};

export const createStudyPlanService = ({
  database,
  now = () => new Date(),
}: {
  database: Database;
  now?: () => Date;
}): StudyPlanService => {
  const getManagedProgramIds = async (
    actor: StudyPlanActor
  ): Promise<string[] | null> => {
    if (isSuperadmin(actor.actorRoles) || isAcademicAdmin(actor.actorRoles)) {
      return null;
    }
    const currentTime = now();
    const rows = await database
      .select({ prodiId: programHeads.prodiId })
      .from(programHeads)
      .where(
        and(
          eq(programHeads.userId, actor.actorUserId),
          lte(programHeads.startsAt, currentTime),
          or(isNull(programHeads.endsAt), gt(programHeads.endsAt, currentTime))
        )
      );
    return [...new Set(rows.map((row) => row.prodiId))];
  };

  const getStudentForActor = async (
    actorUserId: string
  ): Promise<StudentCandidate | null> => {
    const [account] = await database
      .select({ identifier: identityAccounts.identifier })
      .from(identityAccounts)
      .where(eq(identityAccounts.userId, actorUserId))
      .limit(1);
    if (!account) {
      return null;
    }
    const [student] = await database
      .select({
        cohortId: students.cohortId,
        id: students.id,
        name: students.name,
        nim: students.nim,
        studyProgramId: students.studyProgramId,
      })
      .from(students)
      .where(eq(students.nim, account.identifier))
      .limit(1);
    return student ?? null;
  };

  const ensureReadable = async (
    actor: StudyPlanActor,
    studyPlanId: string,
    requireManage = false
  ) => {
    if (requireManage) {
      assertStudyPlanManageRole(actor.actorRoles);
    } else {
      assertStudyPlanReadRole(actor.actorRoles);
    }
    const [row] = await database
      .select({
        academicPeriod: academicPeriods,
        plan: studyPlans,
        student: students,
      })
      .from(studyPlans)
      .innerJoin(
        academicPeriods,
        eq(academicPeriods.id, studyPlans.academicPeriodId)
      )
      .innerJoin(students, eq(students.id, studyPlans.studentId))
      .where(eq(studyPlans.id, studyPlanId))
      .limit(1);
    if (!row) {
      throw new StudyPlanDomainError(
        "STUDY_PLAN_NOT_FOUND",
        "KRS tidak ditemukan."
      );
    }

    if (isSuperadmin(actor.actorRoles) || isAcademicAdmin(actor.actorRoles)) {
      return row;
    }
    if (actor.actorRoles.includes("MAHASISWA")) {
      const student = await getStudentForActor(actor.actorUserId);
      if (!student || student.id !== row.student.id) {
        throw new StudyPlanDomainError(
          "STUDY_PLAN_NOT_FOUND",
          "KRS tidak ditemukan."
        );
      }
      return row;
    }
    const managedProgramIds = await getManagedProgramIds(actor);
    if (!managedProgramIds?.includes(row.student.studyProgramId)) {
      throw new StudyPlanDomainError(
        "STUDY_PLAN_NOT_FOUND",
        "KRS tidak ditemukan."
      );
    }
    return row;
  };

  const detail: StudyPlanService["detail"] = async ({
    actorRoles,
    actorUserId,
    studyPlanId,
  }) => {
    const row = await ensureReadable({ actorRoles, actorUserId }, studyPlanId);
    const [itemRows, historyRows] = await Promise.all([
      database
        .select({
          course: courses,
          item: studyPlanItems,
        })
        .from(studyPlanItems)
        .innerJoin(courses, eq(courses.id, studyPlanItems.courseId))
        .where(eq(studyPlanItems.studyPlanId, studyPlanId))
        .orderBy(asc(studyPlanItems.semester), asc(studyPlanItems.sortOrder)),
      database
        .select()
        .from(studyPlanHistories)
        .where(eq(studyPlanHistories.studyPlanId, studyPlanId))
        .orderBy(desc(studyPlanHistories.createdAt)),
    ]);
    const items = itemRows.map(({ course, item }) => ({
      courseCode: course.code,
      courseId: item.courseId,
      courseName: course.name,
      credits: item.credits,
      curriculumCourseId: item.curriculumCourseId,
      id: item.id,
      semester: item.semester,
      sortOrder: item.sortOrder,
      source: item.source,
    }));
    return {
      academicPeriod: {
        endDate: toIso(row.academicPeriod.endDate),
        id: row.academicPeriod.id,
        startDate: toIso(row.academicPeriod.startDate),
        term: row.academicPeriod.term,
      },
      curriculumId: row.plan.curriculumId,
      histories: historyRows.map((history) => ({
        action: history.action as "GENERATE" | "FINALIZE" | "REOPEN",
        createdAt: toIso(history.createdAt),
        fromStatus: history.fromStatus ? asStatus(history.fromStatus) : null,
        id: history.id,
        reason: history.reason,
        toStatus: history.toStatus ? asStatus(history.toStatus) : null,
      })),
      id: row.plan.id,
      items,
      mode: row.plan.mode as "PACKAGE" | "FREE",
      status: asStatus(row.plan.status),
      student: {
        id: row.student.id,
        name: row.student.name,
        nim: row.student.nim,
        studyProgramId: row.student.studyProgramId,
      },
      totalCourses: row.plan.totalCourses,
      totalCredits: row.plan.totalCredits,
      updatedAt: toIso(row.plan.updatedAt),
      version: row.plan.version,
    } satisfies StudyPlanRecord;
  };

  const list: StudyPlanService["list"] = async ({
    academicPeriodId,
    actorRoles,
    actorUserId,
    prodiId,
    status,
  }) => {
    assertStudyPlanReadRole(actorRoles);
    const conditions = [];
    if (academicPeriodId) {
      conditions.push(eq(studyPlans.academicPeriodId, academicPeriodId));
    }
    if (status) {
      conditions.push(eq(studyPlans.status, status));
    }
    if (prodiId) {
      conditions.push(eq(students.studyProgramId, prodiId));
    }
    if (actorRoles.includes("MAHASISWA")) {
      const student = await getStudentForActor(actorUserId);
      if (!student) {
        return [];
      }
      conditions.push(eq(studyPlans.studentId, student.id));
    } else {
      const managedProgramIds = await getManagedProgramIds({
        actorRoles,
        actorUserId,
      });
      if (managedProgramIds) {
        if (managedProgramIds.length === 0) {
          return [];
        }
        conditions.push(inArray(students.studyProgramId, managedProgramIds));
      }
    }
    const rows = await database
      .select({
        academicPeriod: academicPeriods,
        plan: studyPlans,
        student: students,
      })
      .from(studyPlans)
      .innerJoin(
        academicPeriods,
        eq(academicPeriods.id, studyPlans.academicPeriodId)
      )
      .innerJoin(students, eq(students.id, studyPlans.studentId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(studyPlans.updatedAt));
    return rows.map(({ academicPeriod, plan, student }) => ({
      academicPeriod: {
        endDate: toIso(academicPeriod.endDate),
        id: academicPeriod.id,
        startDate: toIso(academicPeriod.startDate),
        term: academicPeriod.term,
      },
      id: plan.id,
      mode: plan.mode as "PACKAGE" | "FREE",
      status: asStatus(plan.status),
      student: {
        id: student.id,
        name: student.name,
        nim: student.nim,
        studyProgramId: student.studyProgramId,
      },
      totalCourses: plan.totalCourses,
      totalCredits: plan.totalCredits,
      updatedAt: toIso(plan.updatedAt),
    })) satisfies readonly StudyPlanListItem[];
  };

  const listSemesterTrackers: StudyPlanService["listSemesterTrackers"] =
    async ({
      academicPeriodId,
      actorRoles,
      actorUserId,
      cohortId,
      includeInactive = false,
      prodiId,
    }) => {
      assertStudyPlanManageRole(actorRoles);
      const [periodRow] = await database
        .select({
          academicYearStartYear: academicYears.startYear,
          term: academicPeriods.term,
        })
        .from(academicPeriods)
        .innerJoin(
          academicYears,
          eq(academicYears.id, academicPeriods.academicYearId)
        )
        .where(eq(academicPeriods.id, academicPeriodId))
        .limit(1);
      if (!periodRow) {
        throw new StudyPlanDomainError(
          "ACADEMIC_PERIOD_NOT_FOUND",
          "Periode akademik tidak ditemukan."
        );
      }
      const conditions = includeInactive
        ? [eq(students.status, "ACTIVE")]
        : buildGenerationConditions({ cohortId, prodiId });
      if (includeInactive) {
        if (prodiId) {
          conditions.push(eq(students.studyProgramId, prodiId));
        }
        if (cohortId) {
          conditions.push(eq(students.cohortId, cohortId));
        }
      }
      const managedProgramIds = await getManagedProgramIds({
        actorRoles,
        actorUserId,
      });
      if (managedProgramIds) {
        if (managedProgramIds.length === 0) {
          return [];
        }
        conditions.push(inArray(students.studyProgramId, managedProgramIds));
      }
      const rows = await database
        .select({
          entryYear: cohorts.entryYear,
          student: students,
          tracker: studentSemesterTrackers,
        })
        .from(students)
        .innerJoin(cohorts, eq(cohorts.id, students.cohortId))
        .leftJoin(
          studentSemesterTrackers,
          and(
            eq(studentSemesterTrackers.studentId, students.id),
            eq(studentSemesterTrackers.academicPeriodId, academicPeriodId)
          )
        )
        .where(and(...conditions))
        .orderBy(asc(students.nim));
      return rows.map(({ entryYear, student, tracker }) => ({
        entryYear,
        semesterNumber:
          tracker?.semesterNumber ??
          deriveStudentSemester({
            academicYearStartYear: periodRow.academicYearStartYear,
            cohortEntryYear: entryYear,
            term: periodRow.term,
          }),
        source: asTrackerSource(tracker?.source ?? "AUTO"),
        student: {
          academicStatus: asStudentAcademicStatus(student.academicStatus),
          id: student.id,
          name: student.name,
          nim: student.nim,
        },
      })) satisfies readonly StudentSemesterTrackerRecord[];
    };

  const updateSemesterTracker: StudyPlanService["updateSemesterTracker"] =
    async ({
      academicPeriodId,
      actorRoles,
      actorUserId,
      semesterNumber,
      studentId,
    }) => {
      assertStudyPlanManageRole(actorRoles);
      const [row] = await database
        .select({
          entryYear: cohorts.entryYear,
          student: students,
        })
        .from(students)
        .innerJoin(cohorts, eq(cohorts.id, students.cohortId))
        .where(eq(students.id, studentId))
        .limit(1);
      if (!row) {
        throw new StudyPlanDomainError(
          "STUDENT_NOT_FOUND",
          "Mahasiswa tidak ditemukan."
        );
      }
      const managedProgramIds = await getManagedProgramIds({
        actorRoles,
        actorUserId,
      });
      if (
        managedProgramIds &&
        !managedProgramIds.includes(row.student.studyProgramId)
      ) {
        throw new StudyPlanDomainError(
          "STUDENT_NOT_FOUND",
          "Mahasiswa tidak ditemukan."
        );
      }
      const [period] = await database
        .select({ id: academicPeriods.id })
        .from(academicPeriods)
        .where(eq(academicPeriods.id, academicPeriodId))
        .limit(1);
      if (!period) {
        throw new StudyPlanDomainError(
          "ACADEMIC_PERIOD_NOT_FOUND",
          "Periode akademik tidak ditemukan."
        );
      }
      const [tracker] = await database
        .insert(studentSemesterTrackers)
        .values({
          academicPeriodId,
          id: createUuidV7(),
          semesterNumber,
          source: "MANUAL",
          studentId,
        })
        .onConflictDoUpdate({
          set: {
            semesterNumber,
            source: "MANUAL",
            updatedAt: now(),
          },
          target: [
            studentSemesterTrackers.studentId,
            studentSemesterTrackers.academicPeriodId,
          ],
        })
        .returning();
      if (!tracker) {
        throw new StudyPlanDomainError(
          "SEMESTER_TRACKER_SAVE_FAILED",
          "Semester berjalan mahasiswa belum dapat disimpan."
        );
      }
      await database.insert(auditLogs).values({
        action: "UPDATE",
        actorUserId,
        afterState: JSON.stringify({
          academicPeriodId,
          semesterNumber,
          source: "MANUAL",
          studentId,
        }),
        beforeState: null,
        entityId: tracker.id,
        entityType: "STUDENT_SEMESTER_TRACKER",
        id: createUuidV7(),
        metadata: JSON.stringify({ action: "UPDATE_SEMESTER_TRACKER" }),
      });
      return {
        entryYear: row.entryYear,
        semesterNumber: tracker.semesterNumber,
        source: "MANUAL",
        student: {
          academicStatus: asStudentAcademicStatus(row.student.academicStatus),
          id: row.student.id,
          name: row.student.name,
          nim: row.student.nim,
        },
      };
    };

  const generate: StudyPlanService["generate"] = async ({
    academicPeriodId,
    actorRoles,
    actorUserId,
    cohortId,
    idempotencyKey,
    prodiId,
  }) => {
    assertStudyPlanManageRole(actorRoles);
    const [period] = await database
      .select()
      .from(academicPeriods)
      .where(eq(academicPeriods.id, academicPeriodId))
      .limit(1);
    if (!period) {
      throw new StudyPlanDomainError(
        "ACADEMIC_PERIOD_NOT_FOUND",
        "Periode akademik tidak ditemukan.",
        { academicPeriodId: ["Pilih periode akademik yang tersedia."] }
      );
    }
    const [academicYear] = await database
      .select({ startYear: academicYears.startYear })
      .from(academicYears)
      .where(eq(academicYears.id, period.academicYearId))
      .limit(1);
    if (!academicYear) {
      throw new StudyPlanDomainError(
        "ACADEMIC_YEAR_NOT_FOUND",
        "Tahun akademik periode tidak ditemukan.",
        { academicPeriodId: ["Periksa tahun akademik pada periode tersebut."] }
      );
    }
    const key = [
      "package",
      academicPeriodId,
      prodiId ?? "all",
      cohortId ?? "all",
      idempotencyKey?.trim() || "default",
    ].join(":");
    const [existingJob] = await database
      .select()
      .from(studyPlanGenerationJobs)
      .where(
        and(
          eq(studyPlanGenerationJobs.academicPeriodId, academicPeriodId),
          eq(studyPlanGenerationJobs.idempotencyKey, key)
        )
      )
      .limit(1);
    if (
      existingJob?.status === "COMPLETED" ||
      existingJob?.status === "PARTIAL_FAILED"
    ) {
      return {
        completedCount: existingJob.completedCount,
        errorCount: existingJob.errorCount,
        failures: parseFailures(existingJob.failureDetails),
        jobId: existingJob.id,
        processedCount: existingJob.processedCount,
        status: existingJob.status,
        totalCount: existingJob.totalCount,
      };
    }

    const conditions = buildGenerationConditions({ cohortId, prodiId });
    const { job, totalCount } = await initializeGenerationJob({
      academicPeriodId,
      actorUserId,
      conditions,
      database,
      existingJob,
      idempotencyKey: key,
    });
    const progress = await runGenerationJob({
      actorUserId,
      conditions,
      database,
      job,
      now,
      period: {
        academicYearStartYear: academicYear.startYear,
        term: period.term,
      },
    });

    const status =
      progress.failures.length > 0 ? "PARTIAL_FAILED" : "COMPLETED";
    await database
      .update(studyPlanGenerationJobs)
      .set({
        completedCount: progress.completedCount,
        errorCount: progress.failures.length,
        failureDetails: JSON.stringify(progress.failures),
        processedCount: progress.processedCount,
        status,
        updatedAt: now(),
      })
      .where(eq(studyPlanGenerationJobs.id, job.id));
    return {
      completedCount: progress.completedCount,
      errorCount: progress.failures.length,
      failures: progress.failures,
      jobId: job.id,
      processedCount: progress.processedCount,
      status,
      totalCount,
    };
  };

  const finalize: StudyPlanService["finalize"] = async ({
    actorRoles,
    actorUserId,
    studyPlanId,
  }) => {
    const row = await ensureReadable(
      { actorRoles, actorUserId },
      studyPlanId,
      true
    );
    if (row.plan.status !== "DRAFT") {
      throw new StudyPlanDomainError(
        "INVALID_STATUS_TRANSITION",
        "Hanya KRS draft yang dapat difinalisasi."
      );
    }
    if (row.plan.totalCourses < 1) {
      throw new StudyPlanDomainError(
        "EMPTY_STUDY_PLAN",
        "KRS harus memiliki minimal satu mata kuliah."
      );
    }
    const finalized = await database
      .update(studyPlans)
      .set({
        finalizedAt: now(),
        finalizedBy: actorUserId,
        status: "FINAL",
        updatedAt: now(),
        version: row.plan.version + 1,
      })
      .where(
        and(eq(studyPlans.id, studyPlanId), eq(studyPlans.status, "DRAFT"))
      )
      .returning({ id: studyPlans.id });
    if (finalized.length !== 1) {
      throw new StudyPlanDomainError(
        "STALE_STUDY_PLAN",
        "KRS berubah sebelum finalisasi. Muat ulang halaman lalu coba lagi."
      );
    }
    await database.insert(studyPlanHistories).values({
      action: "FINALIZE",
      actorUserId,
      fromStatus: "DRAFT",
      id: createUuidV7(),
      studyPlanId,
      toStatus: "FINAL",
    });
    await database.insert(auditLogs).values({
      action: "UPDATE",
      actorUserId,
      afterState: JSON.stringify({ status: "FINAL" }),
      beforeState: JSON.stringify({ status: "DRAFT" }),
      entityId: studyPlanId,
      entityType: "STUDY_PLAN",
      id: createUuidV7(),
      metadata: JSON.stringify({ action: "FINALIZE" }),
    });
    return { status: "FINAL" };
  };

  const reopen: StudyPlanService["reopen"] = async ({
    actorRoles,
    actorUserId,
    reason,
    studyPlanId,
  }) => {
    const normalizedReason = normalizeStudyPlanReason(reason);
    const row = await ensureReadable(
      { actorRoles, actorUserId },
      studyPlanId,
      true
    );
    if (row.plan.status !== "FINAL") {
      throw new StudyPlanDomainError(
        "INVALID_STATUS_TRANSITION",
        "Hanya KRS final yang dapat dibuka kembali."
      );
    }
    const reopened = await database
      .update(studyPlans)
      .set({
        finalizedAt: null,
        finalizedBy: null,
        status: "DRAFT",
        updatedAt: now(),
        version: row.plan.version + 1,
      })
      .where(
        and(eq(studyPlans.id, studyPlanId), eq(studyPlans.status, "FINAL"))
      )
      .returning({ id: studyPlans.id });
    if (reopened.length !== 1) {
      throw new StudyPlanDomainError(
        "STALE_STUDY_PLAN",
        "KRS berubah sebelum dibuka kembali. Muat ulang halaman lalu coba lagi."
      );
    }
    await database.insert(studyPlanHistories).values({
      action: "REOPEN",
      actorUserId,
      fromStatus: "FINAL",
      id: createUuidV7(),
      reason: normalizedReason,
      studyPlanId,
      toStatus: "DRAFT",
    });
    await database.insert(auditLogs).values({
      action: "UPDATE",
      actorUserId,
      afterState: JSON.stringify({ reason: normalizedReason, status: "DRAFT" }),
      beforeState: JSON.stringify({ status: "FINAL" }),
      entityId: studyPlanId,
      entityType: "STUDY_PLAN",
      id: createUuidV7(),
      metadata: JSON.stringify({ action: "REOPEN", reason: normalizedReason }),
    });
    return { status: "DRAFT" };
  };

  return {
    detail,
    finalize,
    generate,
    list,
    listSemesterTrackers,
    reopen,
    updateSemesterTracker,
  };
};
