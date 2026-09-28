import type { SchedulingService } from "@api/context";
import type { RoleKey } from "@api/identity";
import {
  SchedulingDomainError,
  assertOnlineMeetingChange,
  assertScheduleTransition,
  assertSchedulingReadRole,
  canChangeMeeting,
  normalizeScheduleReason,
  splitEnrollmentIds,
  timeRangesOverlap,
} from "@api/scheduling";
import type {
  ClassMeetingRecord,
  ScheduleConflictRecord,
  ScheduleDraftRecord,
  ScheduleDraftStatus,
  ScheduleSectionRecord,
} from "@api/scheduling";
import type { SchedulingPolicy } from "@api/settings";
import type { Database } from "@db/index";
import { identityAccounts, programHeads } from "@db/schema/identity";
import {
  academicPeriods,
  courses,
  lecturers,
  rooms,
  students,
} from "@db/schema/master-data";
import { auditLogs, notifications } from "@db/schema/platform";
import {
  classEnrollments,
  classMappingJobs,
  classMeetings,
  classSections,
  examSchedules,
  scheduleApprovals,
  scheduleChangeRequests,
  scheduleConflicts,
  scheduleDrafts,
  scheduleRevisions,
  scheduleSlots,
  teachingAssignments,
} from "@db/schema/scheduling";
import { studyPlanItems, studyPlans } from "@db/schema/study-plan";
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

const DEFAULT_CLASS_CAPACITY = 30;
const MEETINGS_PER_TERM = 16;
const WEEK_IN_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;

interface SchedulingActor {
  actorRoles: readonly RoleKey[];
  actorUserId: string;
}

interface ConflictDraft {
  classSectionId: string | null;
  conflictType: ScheduleConflictRecord["conflictType"];
  endAt: Date | null;
  entityIds: readonly string[];
  message: string;
  startAt: Date | null;
}

const isAcademicManager = (roles: readonly RoleKey[]): boolean =>
  roles.includes("SUPERADMIN") || roles.includes("ADMIN_AKADEMIK");

const requireAcademicManager = (roles: readonly RoleKey[]): void => {
  if (!isAcademicManager(roles)) {
    throw new SchedulingDomainError(
      "SCHEDULE_MANAGE_DENIED",
      "Hanya Admin Akademik yang dapat mengelola jadwal."
    );
  }
};

const asDraftStatus = (value: string): ScheduleDraftStatus => {
  if (
    value !== "DRAFT" &&
    value !== "SUBMITTED" &&
    value !== "APPROVED" &&
    value !== "REJECTED" &&
    value !== "PUBLISHED"
  ) {
    throw new SchedulingDomainError(
      "INVALID_SCHEDULE_STATUS",
      "Status jadwal tidak valid."
    );
  }
  return value;
};

const toIso = (value: Date): string => value.toISOString();

const parseEntityIds = (value: string): readonly string[] => {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

const sectionSuffix = (index: number): string => {
  let value = index;
  let suffix = "";
  while (value >= 0) {
    suffix = String.fromCodePoint(65 + (value % 26)) + suffix;
    value = Math.floor(value / 26) - 1;
  }
  return suffix;
};

const unique = (values: readonly string[]): string[] => [...new Set(values)];

export const createSchedulingService = ({
  database,
  getSchedulingPolicy,
  now = () => new Date(),
}: {
  database: Database;
  getSchedulingPolicy: () => Promise<SchedulingPolicy>;
  now?: () => Date;
}): SchedulingService => {
  const getManagedProgramIds = async (
    actor: SchedulingActor
  ): Promise<string[] | null> => {
    if (isAcademicManager(actor.actorRoles)) {
      return null;
    }
    if (!actor.actorRoles.includes("KAPRODI")) {
      return [];
    }
    const currentTime = now();
    const rows = await database
      .select({ studyProgramId: programHeads.prodiId })
      .from(programHeads)
      .where(
        and(
          eq(programHeads.userId, actor.actorUserId),
          lte(programHeads.startsAt, currentTime),
          or(isNull(programHeads.endsAt), gt(programHeads.endsAt, currentTime))
        )
      );
    return unique(rows.map((row) => row.studyProgramId));
  };

  const getActorLecturerId = async (userId: string): Promise<string | null> => {
    const [row] = await database
      .select({ lecturerId: lecturers.id })
      .from(identityAccounts)
      .innerJoin(lecturers, eq(lecturers.dsn, identityAccounts.identifier))
      .where(eq(identityAccounts.userId, userId))
      .limit(1);
    return row?.lecturerId ?? null;
  };

  const getActorStudentId = async (userId: string): Promise<string | null> => {
    const [row] = await database
      .select({ studentId: students.id })
      .from(identityAccounts)
      .innerJoin(students, eq(students.nim, identityAccounts.identifier))
      .where(eq(identityAccounts.userId, userId))
      .limit(1);
    return row?.studentId ?? null;
  };

  const ensureDraftScope = async (
    actor: SchedulingActor,
    draftId: string
  ): Promise<typeof scheduleDrafts.$inferSelect> => {
    const [draft] = await database
      .select()
      .from(scheduleDrafts)
      .where(eq(scheduleDrafts.id, draftId))
      .limit(1);
    if (!draft) {
      throw new SchedulingDomainError(
        "SCHEDULE_DRAFT_NOT_FOUND",
        "Draft jadwal tidak ditemukan."
      );
    }
    const managedProgramIds = await getManagedProgramIds(actor);
    if (
      managedProgramIds &&
      !managedProgramIds.includes(draft.studyProgramId)
    ) {
      throw new SchedulingDomainError(
        "SCHEDULE_DRAFT_NOT_FOUND",
        "Draft jadwal tidak ditemukan."
      );
    }
    return draft;
  };

  const getDraftRecord = async (
    draft: typeof scheduleDrafts.$inferSelect
  ): Promise<ScheduleDraftRecord> => {
    const [slotRows, conflictRows] = await Promise.all([
      database
        .select()
        .from(scheduleSlots)
        .where(eq(scheduleSlots.scheduleDraftId, draft.id))
        .orderBy(asc(scheduleSlots.startAt)),
      database
        .select()
        .from(scheduleConflicts)
        .where(eq(scheduleConflicts.scheduleDraftId, draft.id))
        .orderBy(desc(scheduleConflicts.createdAt)),
    ]);
    return {
      academicPeriodId: draft.academicPeriodId,
      conflicts: conflictRows.map((conflict) => ({
        classSectionId: conflict.classSectionId,
        conflictType:
          conflict.conflictType as ScheduleConflictRecord["conflictType"],
        endAt: conflict.endAt ? toIso(conflict.endAt) : null,
        entityIds: parseEntityIds(conflict.entityIds),
        id: conflict.id,
        message: conflict.message,
        resolvedAt: conflict.resolvedAt ? toIso(conflict.resolvedAt) : null,
        severity: conflict.severity as "BLOCKING" | "WARNING",
        startAt: conflict.startAt ? toIso(conflict.startAt) : null,
      })),
      id: draft.id,
      slots: slotRows.map((slot) => ({
        classSectionId: slot.classSectionId,
        endAt: toIso(slot.endAt),
        id: slot.id,
        instructions: slot.instructions,
        modality: slot.modality as "OFFLINE" | "ONLINE",
        onlineUrl: slot.onlineUrl,
        roomId: slot.roomId,
        startAt: toIso(slot.startAt),
      })),
      status: asDraftStatus(draft.status),
      studyProgramId: draft.studyProgramId,
      version: draft.version,
    };
  };

  // eslint-disable-next-line complexity -- conflict evaluation intentionally covers every blocking rule in one pass.
  const refreshConflicts = async (
    draft: typeof scheduleDrafts.$inferSelect
  ): Promise<number> => {
    await database
      .delete(scheduleConflicts)
      .where(eq(scheduleConflicts.scheduleDraftId, draft.id));
    const [period, slotRows, examRows] = await Promise.all([
      database
        .select()
        .from(academicPeriods)
        .where(eq(academicPeriods.id, draft.academicPeriodId))
        .limit(1)
        .then((rows) => rows[0]),
      database
        .select({ room: rooms, section: classSections, slot: scheduleSlots })
        .from(scheduleSlots)
        .innerJoin(
          classSections,
          eq(classSections.id, scheduleSlots.classSectionId)
        )
        .leftJoin(rooms, eq(rooms.id, scheduleSlots.roomId))
        .where(eq(scheduleSlots.scheduleDraftId, draft.id)),
      database
        .select()
        .from(examSchedules)
        .where(eq(examSchedules.scheduleDraftId, draft.id)),
    ]);
    if (!period) {
      throw new SchedulingDomainError(
        "ACADEMIC_PERIOD_NOT_FOUND",
        "Periode akademik tidak ditemukan."
      );
    }
    const sectionIds = slotRows.map((row) => row.section.id);
    const [enrollmentRows, assignmentRows] = sectionIds.length
      ? await Promise.all([
          database
            .select({
              classSectionId: classEnrollments.classSectionId,
              studentId: classEnrollments.studentId,
            })
            .from(classEnrollments)
            .where(inArray(classEnrollments.classSectionId, sectionIds)),
          database
            .select({ assignment: teachingAssignments, lecturer: lecturers })
            .from(teachingAssignments)
            .innerJoin(
              lecturers,
              eq(lecturers.id, teachingAssignments.lecturerId)
            )
            .where(inArray(teachingAssignments.classSectionId, sectionIds)),
        ])
      : [[], []];
    const studentsBySection = new Map<string, string[]>();
    for (const row of enrollmentRows) {
      const values = studentsBySection.get(row.classSectionId) ?? [];
      values.push(row.studentId);
      studentsBySection.set(row.classSectionId, values);
    }
    const lecturersBySection = new Map<string, string[]>();
    const conflicts: ConflictDraft[] = [];
    for (const row of assignmentRows) {
      const values =
        lecturersBySection.get(row.assignment.classSectionId) ?? [];
      values.push(row.assignment.lecturerId);
      lecturersBySection.set(row.assignment.classSectionId, values);
      if (
        row.lecturer.status !== "ACTIVE" ||
        row.lecturer.academicStatus !== "ACTIVE"
      ) {
        conflicts.push({
          classSectionId: row.assignment.classSectionId,
          conflictType: "INACTIVE_LECTURER",
          endAt: null,
          entityIds: [row.assignment.lecturerId],
          message: "Dosen pengampu tidak aktif.",
          startAt: null,
        });
      }
    }
    for (const row of slotRows) {
      const { room, section, slot } = row;
      if (slot.startAt < period.startDate || slot.endAt > period.endDate) {
        conflicts.push({
          classSectionId: section.id,
          conflictType: "OUTSIDE_PERIOD",
          endAt: slot.endAt,
          entityIds: [section.id],
          message: "Jadwal berada di luar periode akademik.",
          startAt: slot.startAt,
        });
      }
      const incompleteOffline = slot.modality === "OFFLINE" && !room;
      const incompleteOnline =
        slot.modality === "ONLINE" && !slot.onlineUrl && !slot.instructions;
      if (incompleteOffline || incompleteOnline) {
        conflicts.push({
          classSectionId: section.id,
          conflictType: "INCOMPLETE_MODALITY",
          endAt: slot.endAt,
          entityIds: [section.id],
          message:
            slot.modality === "ONLINE"
              ? "Pertemuan daring memerlukan tautan atau instruksi."
              : "Pertemuan luring memerlukan ruang.",
          startAt: slot.startAt,
        });
      }
      if (room?.status !== undefined && room.status !== "ACTIVE") {
        conflicts.push({
          classSectionId: section.id,
          conflictType: "INACTIVE_ROOM",
          endAt: slot.endAt,
          entityIds: [room.id],
          message: "Ruang yang dipilih tidak aktif.",
          startAt: slot.startAt,
        });
      }
      const enrolledCount = studentsBySection.get(section.id)?.length ?? 0;
      if (room && enrolledCount > room.capacity) {
        conflicts.push({
          classSectionId: section.id,
          conflictType: "ROOM_CAPACITY",
          endAt: slot.endAt,
          entityIds: [room.id, section.id],
          message: `Kapasitas ruang ${room.capacity} kurang dari ${enrolledCount} mahasiswa.`,
          startAt: slot.startAt,
        });
      }
    }
    for (let firstIndex = 0; firstIndex < slotRows.length; firstIndex += 1) {
      const first = slotRows[firstIndex];
      if (!first) {
        continue;
      }
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < slotRows.length;
        secondIndex += 1
      ) {
        const second = slotRows[secondIndex];
        if (
          !second ||
          !timeRangesOverlap(
            first.slot.startAt,
            first.slot.endAt,
            second.slot.startAt,
            second.slot.endAt
          )
        ) {
          continue;
        }
        const sharedStudents = (
          studentsBySection.get(first.section.id) ?? []
        ).filter((studentId) =>
          (studentsBySection.get(second.section.id) ?? []).includes(studentId)
        );
        if (sharedStudents.length) {
          conflicts.push({
            classSectionId: first.section.id,
            conflictType: "STUDENT_OVERLAP",
            endAt: first.slot.endAt,
            entityIds: sharedStudents,
            message: "Mahasiswa memiliki jadwal kelas yang bertumpuk.",
            startAt: first.slot.startAt,
          });
        }
        const sharedLecturers = (
          lecturersBySection.get(first.section.id) ?? []
        ).filter((lecturerId) =>
          (lecturersBySection.get(second.section.id) ?? []).includes(lecturerId)
        );
        if (sharedLecturers.length) {
          conflicts.push({
            classSectionId: first.section.id,
            conflictType: "LECTURER_OVERLAP",
            endAt: first.slot.endAt,
            entityIds: sharedLecturers,
            message: "Dosen memiliki jadwal kelas yang bertumpuk.",
            startAt: first.slot.startAt,
          });
        }
        if (first.slot.roomId && first.slot.roomId === second.slot.roomId) {
          conflicts.push({
            classSectionId: first.section.id,
            conflictType: "ROOM_OVERLAP",
            endAt: first.slot.endAt,
            entityIds: [first.slot.roomId],
            message: "Ruang digunakan oleh dua kelas pada waktu yang sama.",
            startAt: first.slot.startAt,
          });
        }
      }
    }
    for (let firstIndex = 0; firstIndex < examRows.length; firstIndex += 1) {
      const first = examRows[firstIndex];
      if (!first) {
        continue;
      }
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < examRows.length;
        secondIndex += 1
      ) {
        const second = examRows[secondIndex];
        if (
          second &&
          first.roomId &&
          first.roomId === second.roomId &&
          timeRangesOverlap(
            first.startAt,
            first.endAt,
            second.startAt,
            second.endAt
          )
        ) {
          conflicts.push({
            classSectionId: first.classSectionId,
            conflictType: "EXAM_OVERLAP",
            endAt: first.endAt,
            entityIds: [first.id, second.id, first.roomId],
            message:
              "Jadwal ujian menggunakan ruang yang sama pada waktu bertumpuk.",
            startAt: first.startAt,
          });
        }
      }
    }
    if (conflicts.length) {
      await database.insert(scheduleConflicts).values(
        conflicts.map((conflict) => ({
          classSectionId: conflict.classSectionId,
          conflictType: conflict.conflictType,
          endAt: conflict.endAt,
          entityIds: JSON.stringify(conflict.entityIds),
          id: crypto.randomUUID(),
          message: conflict.message,
          scheduleDraftId: draft.id,
          severity: "BLOCKING",
          startAt: conflict.startAt,
        }))
      );
    }
    return conflicts.length;
  };

  const notifyClassParticipants = async ({
    body,
    classSectionId,
    route,
    title,
    type,
  }: {
    body: string;
    classSectionId: string;
    route: string;
    title: string;
    type: string;
  }): Promise<void> => {
    const [studentRows, lecturerRows] = await Promise.all([
      database
        .select({ identifier: students.nim })
        .from(classEnrollments)
        .innerJoin(students, eq(students.id, classEnrollments.studentId))
        .where(eq(classEnrollments.classSectionId, classSectionId)),
      database
        .select({ identifier: lecturers.dsn })
        .from(teachingAssignments)
        .innerJoin(lecturers, eq(lecturers.id, teachingAssignments.lecturerId))
        .where(eq(teachingAssignments.classSectionId, classSectionId)),
    ]);
    const identifiers = unique(
      [...studentRows, ...lecturerRows]
        .map((row) => row.identifier)
        .filter((identifier): identifier is string => Boolean(identifier))
    );
    if (!identifiers.length) {
      return;
    }
    const accounts = await database
      .select({ userId: identityAccounts.userId })
      .from(identityAccounts)
      .where(inArray(identityAccounts.identifier, identifiers));
    if (accounts.length) {
      await database.insert(notifications).values(
        accounts.map((account) => ({
          body,
          id: crypto.randomUUID(),
          route,
          title,
          type,
          userId: account.userId,
        }))
      );
    }
  };

  // eslint-disable-next-line complexity -- mapping coordinates durable job state and idempotent enrollment writes.
  const generateMapping: SchedulingService["generateMapping"] = async ({
    academicPeriodId,
    actorRoles,
    actorUserId,
    classCapacity = DEFAULT_CLASS_CAPACITY,
    idempotencyKey,
    studyProgramId,
  }) => {
    requireAcademicManager(actorRoles);
    if (
      !Number.isInteger(classCapacity) ||
      classCapacity < 1 ||
      classCapacity > 500
    ) {
      throw new SchedulingDomainError(
        "INVALID_CLASS_CAPACITY",
        "Kapasitas kelas harus antara 1–500 mahasiswa."
      );
    }
    const key = [
      "class-mapping",
      academicPeriodId,
      studyProgramId ?? "all",
      classCapacity,
      idempotencyKey?.trim() || "default",
    ].join(":");
    const [existingJob] = await database
      .select()
      .from(classMappingJobs)
      .where(
        and(
          eq(classMappingJobs.academicPeriodId, academicPeriodId),
          eq(classMappingJobs.idempotencyKey, key)
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
        jobId: existingJob.id,
        processedCount: existingJob.processedCount,
        status: existingJob.status,
        totalCount: existingJob.totalCount,
      };
    }
    const conditions = [
      eq(studyPlans.academicPeriodId, academicPeriodId),
      eq(studyPlans.status, "FINAL"),
    ];
    if (studyProgramId) {
      conditions.push(eq(students.studyProgramId, studyProgramId));
    }
    const rows = await database
      .select({
        courseCode: courses.code,
        courseId: courses.id,
        itemId: studyPlanItems.id,
        planId: studyPlans.id,
        studentId: students.id,
        studyProgramId: students.studyProgramId,
      })
      .from(studyPlanItems)
      .innerJoin(studyPlans, eq(studyPlans.id, studyPlanItems.studyPlanId))
      .innerJoin(students, eq(students.id, studyPlans.studentId))
      .innerJoin(courses, eq(courses.id, studyPlanItems.courseId))
      .where(and(...conditions))
      .orderBy(asc(students.studyProgramId), asc(courses.id), asc(students.id));
    const activeLecturers = await database
      .select({ id: lecturers.id })
      .from(lecturers)
      .where(
        and(
          eq(lecturers.status, "ACTIVE"),
          eq(lecturers.academicStatus, "ACTIVE")
        )
      )
      .orderBy(asc(lecturers.name));
    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      const groupKey = `${row.studyProgramId}:${row.courseId}`;
      const values = groups.get(groupKey) ?? [];
      values.push(row);
      groups.set(groupKey, values);
    }
    const groupEntries = [...groups.entries()].toSorted(([first], [second]) =>
      first.localeCompare(second)
    );
    const jobId = existingJob?.id ?? crypto.randomUUID();
    if (!existingJob) {
      await database.insert(classMappingJobs).values({
        academicPeriodId,
        createdBy: actorUserId,
        id: jobId,
        idempotencyKey: key,
        status: "PENDING",
        studyProgramId,
        totalCount: groupEntries.length,
      });
    }
    const policy = await getSchedulingPolicy();
    let completedCount = existingJob?.completedCount ?? 0;
    let processedCount = existingJob?.processedCount ?? 0;
    let errorCount = existingJob?.errorCount ?? 0;
    let lecturerIndex = 0;
    await database
      .update(classMappingJobs)
      .set({ status: "RUNNING", updatedAt: now() })
      .where(eq(classMappingJobs.id, jobId));
    for (const [groupKey, groupRows] of groupEntries) {
      if (
        existingJob?.checkpointGroupKey &&
        groupKey <= existingJob.checkpointGroupKey
      ) {
        continue;
      }
      try {
        const rowByItemId = new Map(groupRows.map((row) => [row.itemId, row]));
        const chunks = splitEnrollmentIds(
          groupRows.map((row) => row.itemId),
          classCapacity
        );
        for (let index = 0; index < chunks.length; index += 1) {
          const itemIds = chunks[index] ?? [];
          const first = itemIds[0] ? rowByItemId.get(itemIds[0]) : undefined;
          if (!first) {
            continue;
          }
          const code = `${first.courseCode}-${sectionSuffix(index)}`;
          // Each group advances only after its section and enrollments are durable.
          // eslint-disable-next-line no-await-in-loop
          await database
            .insert(classSections)
            .values({
              academicPeriodId,
              capacity: classCapacity,
              code,
              courseId: first.courseId,
              id: crypto.randomUUID(),
              mappingJobId: jobId,
              policyLeadDays: policy.leadDays,
              policyMaxOnlineMeetings: policy.onlineMeetingLimit,
              status: "DRAFT",
              studyProgramId: first.studyProgramId,
            })
            .onConflictDoNothing();
          // eslint-disable-next-line no-await-in-loop
          const [section] = await database
            .select()
            .from(classSections)
            .where(
              and(
                eq(classSections.academicPeriodId, academicPeriodId),
                eq(classSections.courseId, first.courseId),
                eq(classSections.code, code)
              )
            )
            .limit(1);
          if (!section) {
            throw new SchedulingDomainError(
              "CLASS_SECTION_UNAVAILABLE",
              "Kelas kuliah belum dapat dibentuk."
            );
          }
          const lecturer =
            activeLecturers[lecturerIndex % activeLecturers.length];
          if (lecturer) {
            lecturerIndex += 1;
            // Assignment is idempotent so a resumed job never duplicates teaching staff.
            // eslint-disable-next-line no-await-in-loop
            await database
              .insert(teachingAssignments)
              .values({
                classSectionId: section.id,
                id: crypto.randomUUID(),
                isPrimary: true,
                lecturerId: lecturer.id,
              })
              .onConflictDoNothing();
          }
          // eslint-disable-next-line no-await-in-loop
          await database
            .insert(classEnrollments)
            .values(
              itemIds.flatMap((itemId) => {
                const row = rowByItemId.get(itemId);
                return row
                  ? [
                      {
                        classSectionId: section.id,
                        id: crypto.randomUUID(),
                        studentId: row.studentId,
                        studyPlanId: row.planId,
                        studyPlanItemId: row.itemId,
                      },
                    ]
                  : [];
              })
            )
            .onConflictDoNothing();
        }
        completedCount += 1;
      } catch {
        errorCount += 1;
      }
      processedCount += 1;
      // eslint-disable-next-line no-await-in-loop
      await database
        .update(classMappingJobs)
        .set({
          checkpointGroupKey: groupKey,
          completedCount,
          errorCount,
          processedCount,
          updatedAt: now(),
        })
        .where(eq(classMappingJobs.id, jobId));
    }
    const status = errorCount > 0 ? "PARTIAL_FAILED" : "COMPLETED";
    await database
      .update(classMappingJobs)
      .set({ status, updatedAt: now() })
      .where(eq(classMappingJobs.id, jobId));
    return {
      completedCount,
      errorCount,
      jobId,
      processedCount,
      status,
      totalCount: groupEntries.length,
    };
  };

  const listSections: SchedulingService["listSections"] = async ({
    academicPeriodId,
    actorRoles,
    actorUserId,
    studyProgramId,
  }) => {
    assertSchedulingReadRole(actorRoles);
    const conditions = [];
    if (academicPeriodId) {
      conditions.push(eq(classSections.academicPeriodId, academicPeriodId));
    }
    if (studyProgramId) {
      conditions.push(eq(classSections.studyProgramId, studyProgramId));
    }
    const managedProgramIds = await getManagedProgramIds({
      actorRoles,
      actorUserId,
    });
    if (managedProgramIds) {
      if (!managedProgramIds.length) {
        return [];
      }
      conditions.push(inArray(classSections.studyProgramId, managedProgramIds));
    }
    const lecturerId = actorRoles.includes("DOSEN")
      ? await getActorLecturerId(actorUserId)
      : null;
    const studentId = actorRoles.includes("MAHASISWA")
      ? await getActorStudentId(actorUserId)
      : null;
    if (actorRoles.includes("DOSEN") && !lecturerId) {
      return [];
    }
    if (actorRoles.includes("MAHASISWA") && !studentId) {
      return [];
    }
    const rows = await database
      .select({ course: courses, section: classSections })
      .from(classSections)
      .innerJoin(courses, eq(courses.id, classSections.courseId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(courses.code), asc(classSections.code));
    const sectionIds = rows.map((row) => row.section.id);
    if (!sectionIds.length) {
      return [];
    }
    const [counts, assignmentRows, actorEnrollments] = await Promise.all([
      database
        .select({
          classSectionId: classEnrollments.classSectionId,
          count: sql<number>`count(*)`,
        })
        .from(classEnrollments)
        .where(inArray(classEnrollments.classSectionId, sectionIds))
        .groupBy(classEnrollments.classSectionId),
      database
        .select({
          classSectionId: teachingAssignments.classSectionId,
          lecturerId: lecturers.id,
          lecturerName: lecturers.name,
        })
        .from(teachingAssignments)
        .innerJoin(lecturers, eq(lecturers.id, teachingAssignments.lecturerId))
        .where(inArray(teachingAssignments.classSectionId, sectionIds)),
      studentId
        ? database
            .select({ classSectionId: classEnrollments.classSectionId })
            .from(classEnrollments)
            .where(
              and(
                inArray(classEnrollments.classSectionId, sectionIds),
                eq(classEnrollments.studentId, studentId)
              )
            )
        : Promise.resolve([]),
    ]);
    const countBySection = new Map(
      counts.map((row) => [row.classSectionId, Number(row.count)])
    );
    const lecturersBySection = new Map<string, string[]>();
    const lecturerSectionIds = new Set<string>();
    for (const row of assignmentRows) {
      const names = lecturersBySection.get(row.classSectionId) ?? [];
      names.push(row.lecturerName);
      lecturersBySection.set(row.classSectionId, names);
      if (row.lecturerId === lecturerId) {
        lecturerSectionIds.add(row.classSectionId);
      }
    }
    const studentSectionIds = new Set(
      actorEnrollments.map((row) => row.classSectionId)
    );
    return rows
      .filter(({ section }) => {
        if (lecturerId) {
          return lecturerSectionIds.has(section.id);
        }
        if (studentId) {
          return studentSectionIds.has(section.id);
        }
        return true;
      })
      .map(({ course, section }) => ({
        capacity: section.capacity,
        code: section.code,
        courseCode: course.code,
        courseName: course.name,
        enrolledCount: countBySection.get(section.id) ?? 0,
        id: section.id,
        lecturerNames: lecturersBySection.get(section.id) ?? [],
        policyLeadDays: section.policyLeadDays,
        policyMaxOnlineMeetings: section.policyMaxOnlineMeetings,
        status: section.status as ScheduleSectionRecord["status"],
        studyProgramId: section.studyProgramId,
      }));
  };

  const createDraft: SchedulingService["createDraft"] = async ({
    academicPeriodId,
    actorRoles,
    actorUserId,
    studyProgramId,
  }) => {
    requireAcademicManager(actorRoles);
    const id = crypto.randomUUID();
    await database.insert(scheduleDrafts).values({
      academicPeriodId,
      createdBy: actorUserId,
      id,
      status: "DRAFT",
      studyProgramId,
    });
    const [draft] = await database
      .select()
      .from(scheduleDrafts)
      .where(eq(scheduleDrafts.id, id))
      .limit(1);
    if (!draft) {
      throw new SchedulingDomainError(
        "SCHEDULE_DRAFT_UNAVAILABLE",
        "Draft jadwal belum dapat dibuat."
      );
    }
    return getDraftRecord(draft);
  };

  const listDrafts: SchedulingService["listDrafts"] = async ({
    actorRoles,
    actorUserId,
    status,
  }) => {
    assertSchedulingReadRole(actorRoles);
    const conditions = status ? [eq(scheduleDrafts.status, status)] : [];
    const managedProgramIds = await getManagedProgramIds({
      actorRoles,
      actorUserId,
    });
    if (managedProgramIds) {
      if (!managedProgramIds.length) {
        return [];
      }
      conditions.push(
        inArray(scheduleDrafts.studyProgramId, managedProgramIds)
      );
    }
    const rows = await database
      .select()
      .from(scheduleDrafts)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(scheduleDrafts.updatedAt));
    return Promise.all(rows.map((row) => getDraftRecord(row)));
  };

  const detailDraft: SchedulingService["detailDraft"] = async ({
    actorRoles,
    actorUserId,
    draftId,
  }) => {
    assertSchedulingReadRole(actorRoles);
    return getDraftRecord(
      await ensureDraftScope({ actorRoles, actorUserId }, draftId)
    );
  };

  const upsertSlot: SchedulingService["upsertSlot"] = async (input) => {
    requireAcademicManager(input.actorRoles);
    const draft = await ensureDraftScope(input, input.draftId);
    if (draft.status !== "DRAFT" && draft.status !== "REJECTED") {
      throw new SchedulingDomainError(
        "IMMUTABLE_SCHEDULE",
        "Hanya draft jadwal yang dapat diubah."
      );
    }
    if (input.endAt <= input.startAt) {
      throw new SchedulingDomainError(
        "INVALID_TIME_RANGE",
        "Waktu selesai harus setelah waktu mulai."
      );
    }
    if (input.modality === "ONLINE") {
      assertOnlineMeetingChange({
        currentOnlineMeetings: 0,
        instructions: input.instructions,
        maximumOnlineMeetings: 1,
        onlineUrl: input.onlineUrl,
      });
    } else if (!input.roomId) {
      throw new SchedulingDomainError(
        "ROOM_REQUIRED",
        "Pertemuan luring memerlukan ruang."
      );
    }
    const [section] = await database
      .select()
      .from(classSections)
      .where(
        and(
          eq(classSections.id, input.classSectionId),
          eq(classSections.academicPeriodId, draft.academicPeriodId),
          eq(classSections.studyProgramId, draft.studyProgramId)
        )
      )
      .limit(1);
    if (!section) {
      throw new SchedulingDomainError(
        "CLASS_SECTION_NOT_FOUND",
        "Kelas kuliah tidak ditemukan."
      );
    }
    const [existing] = await database
      .select()
      .from(scheduleSlots)
      .where(
        and(
          eq(scheduleSlots.scheduleDraftId, draft.id),
          eq(scheduleSlots.classSectionId, input.classSectionId)
        )
      )
      .limit(1);
    const slotId = existing?.id ?? crypto.randomUUID();
    // eslint-disable-next-line prefer-ternary -- update and insert use different Drizzle statements.
    if (existing) {
      // eslint-disable-next-line no-await-in-loop
      await database
        .update(scheduleSlots)
        .set({
          endAt: input.endAt,
          instructions: input.instructions?.trim() || null,
          modality: input.modality,
          onlineUrl: input.onlineUrl?.trim() || null,
          roomId: input.modality === "OFFLINE" ? input.roomId : null,
          startAt: input.startAt,
          updatedAt: now(),
        })
        .where(eq(scheduleSlots.id, existing.id));
    } else {
      await database.insert(scheduleSlots).values({
        classSectionId: input.classSectionId,
        endAt: input.endAt,
        id: slotId,
        instructions: input.instructions?.trim() || null,
        modality: input.modality,
        onlineUrl: input.onlineUrl?.trim() || null,
        roomId: input.modality === "OFFLINE" ? input.roomId : null,
        scheduleDraftId: draft.id,
        startAt: input.startAt,
      });
    }
    await database
      .update(scheduleDrafts)
      .set({ status: "DRAFT", updatedAt: now(), version: draft.version + 1 })
      .where(eq(scheduleDrafts.id, draft.id));
    return { slotId };
  };

  const submitDraft: SchedulingService["submitDraft"] = async ({
    actorRoles,
    actorUserId,
    draftId,
    expectedVersion,
  }) => {
    requireAcademicManager(actorRoles);
    const draft = await ensureDraftScope({ actorRoles, actorUserId }, draftId);
    const conflictCount = await refreshConflicts(draft);
    assertScheduleTransition(asDraftStatus(draft.status), "SUBMITTED", {
      hasBlockingConflicts: conflictCount > 0,
    });
    const updated = await database
      .update(scheduleDrafts)
      .set({
        status: "SUBMITTED",
        submittedAt: now(),
        submittedBy: actorUserId,
        updatedAt: now(),
        version: draft.version + 1,
      })
      .where(
        and(
          eq(scheduleDrafts.id, draftId),
          eq(scheduleDrafts.status, "DRAFT"),
          eq(scheduleDrafts.version, expectedVersion)
        )
      )
      .returning({ id: scheduleDrafts.id });
    if (updated.length !== 1) {
      throw new SchedulingDomainError(
        "STALE_SCHEDULE_DRAFT",
        "Draft jadwal telah berubah. Muat ulang lalu coba lagi."
      );
    }
    return { status: "SUBMITTED" };
  };

  const decideDraft: SchedulingService["decideDraft"] = async ({
    actorRoles,
    actorUserId,
    approve,
    draftId,
    expectedVersion,
    reason,
  }) => {
    if (!actorRoles.includes("KAPRODI")) {
      throw new SchedulingDomainError(
        "SCHEDULE_APPROVAL_DENIED",
        "Hanya Kaprodi yang dapat memutuskan persetujuan jadwal."
      );
    }
    const draft = await ensureDraftScope({ actorRoles, actorUserId }, draftId);
    const targetStatus = approve ? "APPROVED" : "REJECTED";
    const normalizedReason = approve
      ? undefined
      : normalizeScheduleReason(reason ?? "");
    if (approve) {
      const conflictCount = await refreshConflicts(draft);
      if (conflictCount > 0) {
        throw new SchedulingDomainError(
          "BLOCKING_CONFLICTS",
          "Jadwal memiliki konflik baru dan belum dapat disetujui."
        );
      }
    }
    assertScheduleTransition(asDraftStatus(draft.status), targetStatus, {
      rejectionReason: normalizedReason,
    });
    const updated = await database
      .update(scheduleDrafts)
      .set({
        approvedAt: approve ? now() : null,
        approvedBy: approve ? actorUserId : null,
        rejectionReason: normalizedReason ?? null,
        status: targetStatus,
        updatedAt: now(),
        version: draft.version + 1,
      })
      .where(
        and(
          eq(scheduleDrafts.id, draftId),
          eq(scheduleDrafts.status, "SUBMITTED"),
          eq(scheduleDrafts.version, expectedVersion)
        )
      )
      .returning({ id: scheduleDrafts.id });
    if (updated.length !== 1) {
      throw new SchedulingDomainError(
        "STALE_SCHEDULE_DRAFT",
        "Draft jadwal telah berubah. Muat ulang lalu coba lagi."
      );
    }
    await database.insert(scheduleApprovals).values({
      actorUserId,
      decision: approve ? "APPROVE" : "REJECT",
      draftVersion: expectedVersion,
      id: crypto.randomUUID(),
      reason: normalizedReason,
      scheduleDraftId: draftId,
    });
    return { status: targetStatus };
  };

  const publishDraft: SchedulingService["publishDraft"] = async ({
    actorRoles,
    actorUserId,
    draftId,
    expectedVersion,
  }) => {
    requireAcademicManager(actorRoles);
    const draft = await ensureDraftScope({ actorRoles, actorUserId }, draftId);
    assertScheduleTransition(asDraftStatus(draft.status), "PUBLISHED");
    const slots = await database
      .select()
      .from(scheduleSlots)
      .where(eq(scheduleSlots.scheduleDraftId, draftId));
    if (!slots.length) {
      throw new SchedulingDomainError(
        "EMPTY_SCHEDULE",
        "Jadwal harus memiliki minimal satu slot sebelum diterbitkan."
      );
    }
    const updated = await database
      .update(scheduleDrafts)
      .set({
        publishedAt: now(),
        publishedBy: actorUserId,
        status: "PUBLISHED",
        updatedAt: now(),
        version: draft.version + 1,
      })
      .where(
        and(
          eq(scheduleDrafts.id, draftId),
          eq(scheduleDrafts.status, "APPROVED"),
          eq(scheduleDrafts.version, expectedVersion)
        )
      )
      .returning({ id: scheduleDrafts.id });
    if (updated.length !== 1) {
      throw new SchedulingDomainError(
        "STALE_SCHEDULE_DRAFT",
        "Draft jadwal telah berubah. Muat ulang lalu coba lagi."
      );
    }
    for (const slot of slots) {
      const meetingValues = [];
      for (let sequence = 1; sequence <= MEETINGS_PER_TERM; sequence += 1) {
        const offset = (sequence - 1) * WEEK_IN_MILLISECONDS;
        meetingValues.push({
          classSectionId: slot.classSectionId,
          endAt: new Date(slot.endAt.getTime() + offset),
          id: crypto.randomUUID(),
          instructions: slot.instructions,
          modality: slot.modality,
          onlineUrl: slot.onlineUrl,
          roomId: slot.roomId,
          sequence,
          startAt: new Date(slot.startAt.getTime() + offset),
        });
      }
      // eslint-disable-next-line no-await-in-loop
      await database
        .insert(classMeetings)
        .values(meetingValues)
        .onConflictDoNothing();
      const publishedAt = now();
      // eslint-disable-next-line no-await-in-loop
      await database.insert(scheduleRevisions).values(
        meetingValues.map((meeting) => ({
          changedBy: actorUserId,
          effectiveFrom: publishedAt,
          endAt: meeting.endAt,
          id: crypto.randomUUID(),
          instructions: meeting.instructions,
          meetingId: meeting.id,
          modality: meeting.modality,
          onlineUrl: meeting.onlineUrl,
          reason: "Jadwal awal diterbitkan.",
          roomId: meeting.roomId,
          startAt: meeting.startAt,
          version: 1,
        }))
      );
      // eslint-disable-next-line no-await-in-loop
      await database
        .update(classSections)
        .set({ status: "PUBLISHED", updatedAt: now() })
        .where(eq(classSections.id, slot.classSectionId));
      // eslint-disable-next-line no-await-in-loop
      await notifyClassParticipants({
        body: "Jadwal kelas telah diterbitkan. Periksa rincian waktu dan ruang terbaru.",
        classSectionId: slot.classSectionId,
        route: "/mahasiswa/jadwal",
        title: "Jadwal kelas diterbitkan",
        type: "SCHEDULE_PUBLISHED",
      });
    }
    await database.insert(auditLogs).values({
      action: "UPDATE",
      actorUserId,
      afterState: JSON.stringify({ status: "PUBLISHED" }),
      beforeState: JSON.stringify({ status: "APPROVED" }),
      entityId: draftId,
      entityType: "SCHEDULE_DRAFT",
      id: crypto.randomUUID(),
      metadata: JSON.stringify({ action: "PUBLISH" }),
    });
    return { status: "PUBLISHED" };
  };

  const listMeetings: SchedulingService["listMeetings"] = async ({
    actorRoles,
    actorUserId,
  }) => {
    assertSchedulingReadRole(actorRoles);
    const rows = await database
      .select({
        courseName: courses.name,
        meeting: classMeetings,
        section: classSections,
      })
      .from(classMeetings)
      .innerJoin(
        classSections,
        eq(classSections.id, classMeetings.classSectionId)
      )
      .innerJoin(courses, eq(courses.id, classSections.courseId))
      .orderBy(asc(classMeetings.startAt));
    const sectionIds = unique(rows.map((row) => row.section.id));
    let allowedSectionIds: ReadonlySet<string> | null = null;
    if (actorRoles.includes("DOSEN")) {
      const lecturerId = await getActorLecturerId(actorUserId);
      if (!lecturerId) {
        return [];
      }
      const assignments = await database
        .select({ classSectionId: teachingAssignments.classSectionId })
        .from(teachingAssignments)
        .where(
          and(
            eq(teachingAssignments.lecturerId, lecturerId),
            inArray(teachingAssignments.classSectionId, sectionIds)
          )
        );
      allowedSectionIds = new Set(assignments.map((row) => row.classSectionId));
    } else if (actorRoles.includes("MAHASISWA")) {
      const studentId = await getActorStudentId(actorUserId);
      if (!studentId) {
        return [];
      }
      const enrollments = await database
        .select({ classSectionId: classEnrollments.classSectionId })
        .from(classEnrollments)
        .where(
          and(
            eq(classEnrollments.studentId, studentId),
            inArray(classEnrollments.classSectionId, sectionIds)
          )
        );
      allowedSectionIds = new Set(enrollments.map((row) => row.classSectionId));
    } else {
      const managed = await getManagedProgramIds({ actorRoles, actorUserId });
      if (managed) {
        allowedSectionIds = new Set(
          rows
            .filter((row) => managed.includes(row.section.studyProgramId))
            .map((row) => row.section.id)
        );
      }
    }
    return rows
      .filter(
        (row) => !allowedSectionIds || allowedSectionIds.has(row.section.id)
      )
      .map(({ courseName, meeting, section }) => ({
        classCode: section.code,
        classSectionId: section.id,
        courseName,
        endAt: toIso(meeting.endAt),
        id: meeting.id,
        instructions: meeting.instructions,
        modality: meeting.modality as "OFFLINE" | "ONLINE",
        onlineUrl: meeting.onlineUrl,
        roomId: meeting.roomId,
        sequence: meeting.sequence,
        startAt: toIso(meeting.startAt),
        version: meeting.version,
      })) satisfies readonly ClassMeetingRecord[];
  };

  const ensureLecturerOwnsMeeting = async (
    actor: SchedulingActor,
    meetingId: string
  ) => {
    if (!actor.actorRoles.includes("DOSEN")) {
      throw new SchedulingDomainError(
        "MEETING_CHANGE_DENIED",
        "Hanya dosen pengampu yang dapat mengubah pertemuan."
      );
    }
    const lecturerId = await getActorLecturerId(actor.actorUserId);
    const [row] = lecturerId
      ? await database
          .select({ meeting: classMeetings, section: classSections })
          .from(classMeetings)
          .innerJoin(
            classSections,
            eq(classSections.id, classMeetings.classSectionId)
          )
          .innerJoin(
            teachingAssignments,
            eq(teachingAssignments.classSectionId, classSections.id)
          )
          .where(
            and(
              eq(classMeetings.id, meetingId),
              eq(teachingAssignments.lecturerId, lecturerId)
            )
          )
          .limit(1)
      : [];
    if (!row) {
      throw new SchedulingDomainError(
        "MEETING_NOT_FOUND",
        "Pertemuan tidak ditemukan."
      );
    }
    return row;
  };

  const updateMeetingOnline: SchedulingService["updateMeetingOnline"] = async ({
    actorRoles,
    actorUserId,
    instructions,
    meetingId,
    onlineUrl,
  }) => {
    const row = await ensureLecturerOwnsMeeting(
      { actorRoles, actorUserId },
      meetingId
    );
    if (
      !canChangeMeeting(
        row.meeting.startAt,
        now(),
        { leadDays: row.section.policyLeadDays },
        "Asia/Jakarta"
      )
    ) {
      throw new SchedulingDomainError(
        "SCHEDULE_CHANGE_CUTOFF_PASSED",
        "Batas waktu perubahan pertemuan telah lewat."
      );
    }
    const [countRow] = await database
      .select({ count: sql<number>`count(*)` })
      .from(classMeetings)
      .where(
        and(
          eq(classMeetings.classSectionId, row.section.id),
          eq(classMeetings.modality, "ONLINE")
        )
      );
    assertOnlineMeetingChange({
      currentOnlineMeetings: Number(countRow?.count ?? 0),
      instructions,
      maximumOnlineMeetings: row.section.policyMaxOnlineMeetings,
      onlineUrl,
    });
    const changedAt = now();
    await database
      .update(scheduleRevisions)
      .set({ effectiveUntil: changedAt })
      .where(
        and(
          eq(scheduleRevisions.meetingId, meetingId),
          isNull(scheduleRevisions.effectiveUntil)
        )
      );
    await database.insert(scheduleRevisions).values({
      changedBy: actorUserId,
      effectiveFrom: changedAt,
      endAt: row.meeting.endAt,
      id: crypto.randomUUID(),
      instructions: instructions?.trim() || null,
      meetingId,
      modality: "ONLINE",
      onlineUrl: onlineUrl?.trim() || null,
      reason: "Perubahan pertemuan menjadi daring oleh dosen pengampu.",
      roomId: null,
      startAt: row.meeting.startAt,
      version: row.meeting.version + 1,
    });
    await database
      .update(classMeetings)
      .set({
        instructions: instructions?.trim() || null,
        modality: "ONLINE",
        onlineUrl: onlineUrl?.trim() || null,
        roomId: null,
        updatedAt: changedAt,
        version: row.meeting.version + 1,
      })
      .where(eq(classMeetings.id, meetingId));
    await notifyClassParticipants({
      body: `Pertemuan ke-${row.meeting.sequence} diubah menjadi daring.`,
      classSectionId: row.section.id,
      route: "/mahasiswa/jadwal",
      title: "Perubahan pertemuan",
      type: "MEETING_CHANGED_ONLINE",
    });
    return { status: "ONLINE" };
  };

  const requestOfflineChange: SchedulingService["requestOfflineChange"] =
    async ({
      actorRoles,
      actorUserId,
      endAt,
      meetingId,
      reason,
      roomId,
      startAt,
    }) => {
      const row = await ensureLecturerOwnsMeeting(
        { actorRoles, actorUserId },
        meetingId
      );
      if (
        !canChangeMeeting(
          row.meeting.startAt,
          now(),
          { leadDays: row.section.policyLeadDays },
          "Asia/Jakarta"
        )
      ) {
        throw new SchedulingDomainError(
          "SCHEDULE_CHANGE_CUTOFF_PASSED",
          "Batas waktu perubahan pertemuan telah lewat."
        );
      }
      if (endAt <= startAt) {
        throw new SchedulingDomainError(
          "INVALID_TIME_RANGE",
          "Waktu selesai harus setelah waktu mulai."
        );
      }
      const normalizedReason = normalizeScheduleReason(reason);
      const [activeRoom] = await database
        .select({ id: rooms.id })
        .from(rooms)
        .where(and(eq(rooms.id, roomId), eq(rooms.status, "ACTIVE")))
        .limit(1);
      if (!activeRoom) {
        throw new SchedulingDomainError(
          "ROOM_NOT_FOUND",
          "Ruang aktif tidak ditemukan."
        );
      }
      const requestId = crypto.randomUUID();
      await database.insert(scheduleChangeRequests).values({
        id: requestId,
        meetingId,
        proposedEndAt: endAt,
        proposedRoomId: roomId,
        proposedStartAt: startAt,
        reason: normalizedReason,
        requestedBy: actorUserId,
        status: "PENDING",
      });
      return { requestId, status: "PENDING" };
    };

  const listChangeRequests: SchedulingService["listChangeRequests"] = async ({
    actorRoles,
    actorUserId,
    status,
  }) => {
    assertSchedulingReadRole(actorRoles);
    const rows = await database
      .select({ request: scheduleChangeRequests, section: classSections })
      .from(scheduleChangeRequests)
      .innerJoin(
        classMeetings,
        eq(classMeetings.id, scheduleChangeRequests.meetingId)
      )
      .innerJoin(
        classSections,
        eq(classSections.id, classMeetings.classSectionId)
      )
      .where(status ? eq(scheduleChangeRequests.status, status) : undefined)
      .orderBy(desc(scheduleChangeRequests.createdAt));
    const managed = await getManagedProgramIds({ actorRoles, actorUserId });
    return rows
      .filter((row) => !managed || managed.includes(row.section.studyProgramId))
      .map(({ request, section }) => ({
        classCode: section.code,
        createdAt: toIso(request.createdAt),
        id: request.id,
        meetingId: request.meetingId,
        proposedEndAt: toIso(request.proposedEndAt),
        proposedRoomId: request.proposedRoomId,
        proposedStartAt: toIso(request.proposedStartAt),
        reason: request.reason,
        status: request.status as "PENDING" | "APPROVED" | "REJECTED",
      }));
  };

  const decideOfflineChange: SchedulingService["decideOfflineChange"] = async ({
    actorRoles,
    actorUserId,
    approve,
    reason,
    requestId,
  }) => {
    requireAcademicManager(actorRoles);
    const [row] = await database
      .select({
        meeting: classMeetings,
        request: scheduleChangeRequests,
        room: rooms,
        section: classSections,
      })
      .from(scheduleChangeRequests)
      .innerJoin(
        classMeetings,
        eq(classMeetings.id, scheduleChangeRequests.meetingId)
      )
      .innerJoin(
        classSections,
        eq(classSections.id, classMeetings.classSectionId)
      )
      .innerJoin(rooms, eq(rooms.id, scheduleChangeRequests.proposedRoomId))
      .where(eq(scheduleChangeRequests.id, requestId))
      .limit(1);
    if (!row || row.request.status !== "PENDING") {
      throw new SchedulingDomainError(
        "CHANGE_REQUEST_NOT_FOUND",
        "Pengajuan perubahan jadwal tidak ditemukan."
      );
    }
    if (!approve) {
      const normalizedReason = normalizeScheduleReason(reason ?? "");
      await database
        .update(scheduleChangeRequests)
        .set({
          decidedAt: now(),
          decidedBy: actorUserId,
          decisionReason: normalizedReason,
          status: "REJECTED",
          updatedAt: now(),
        })
        .where(
          and(
            eq(scheduleChangeRequests.id, requestId),
            eq(scheduleChangeRequests.status, "PENDING")
          )
        );
      return { status: "REJECTED" };
    }
    if (
      !canChangeMeeting(
        row.meeting.startAt,
        now(),
        { leadDays: row.section.policyLeadDays },
        "Asia/Jakarta"
      )
    ) {
      throw new SchedulingDomainError(
        "SCHEDULE_CHANGE_CUTOFF_PASSED",
        "Batas waktu perubahan pertemuan telah lewat."
      );
    }
    if (row.room.status !== "ACTIVE") {
      throw new SchedulingDomainError(
        "INACTIVE_ROOM",
        "Ruang tujuan tidak aktif."
      );
    }
    const overlappingRooms = await database
      .select({ id: classMeetings.id })
      .from(classMeetings)
      .where(
        and(
          eq(classMeetings.roomId, row.request.proposedRoomId),
          lte(classMeetings.startAt, row.request.proposedEndAt),
          gt(classMeetings.endAt, row.request.proposedStartAt)
        )
      );
    if (overlappingRooms.some((meeting) => meeting.id !== row.meeting.id)) {
      throw new SchedulingDomainError(
        "ROOM_OVERLAP",
        "Ruang tujuan telah dipakai pada waktu yang diajukan."
      );
    }
    const changedAt = now();
    await database
      .update(scheduleRevisions)
      .set({ effectiveUntil: changedAt })
      .where(
        and(
          eq(scheduleRevisions.meetingId, row.meeting.id),
          isNull(scheduleRevisions.effectiveUntil)
        )
      );
    await database.insert(scheduleRevisions).values({
      changeRequestId: requestId,
      changedBy: actorUserId,
      effectiveFrom: changedAt,
      endAt: row.request.proposedEndAt,
      id: crypto.randomUUID(),
      instructions: row.meeting.instructions,
      meetingId: row.meeting.id,
      modality: "OFFLINE",
      onlineUrl: null,
      reason: row.request.reason,
      roomId: row.request.proposedRoomId,
      startAt: row.request.proposedStartAt,
      version: row.meeting.version + 1,
    });
    await database
      .update(classMeetings)
      .set({
        endAt: row.request.proposedEndAt,
        modality: "OFFLINE",
        onlineUrl: null,
        roomId: row.request.proposedRoomId,
        startAt: row.request.proposedStartAt,
        updatedAt: changedAt,
        version: row.meeting.version + 1,
      })
      .where(eq(classMeetings.id, row.meeting.id));
    await database
      .update(scheduleChangeRequests)
      .set({
        decidedAt: changedAt,
        decidedBy: actorUserId,
        status: "APPROVED",
        updatedAt: changedAt,
      })
      .where(
        and(
          eq(scheduleChangeRequests.id, requestId),
          eq(scheduleChangeRequests.status, "PENDING")
        )
      );
    await notifyClassParticipants({
      body: `Perubahan pertemuan ke-${row.meeting.sequence} telah disetujui.`,
      classSectionId: row.section.id,
      route: "/mahasiswa/jadwal",
      title: "Jadwal pertemuan diperbarui",
      type: "MEETING_CHANGE_APPROVED",
    });
    return { status: "APPROVED" };
  };

  return {
    createDraft,
    decideDraft,
    decideOfflineChange,
    detailDraft,
    generateMapping,
    listChangeRequests,
    listDrafts,
    listMeetings,
    listSections,
    publishDraft,
    requestOfflineChange,
    submitDraft,
    updateMeetingOnline,
    upsertSlot,
  };
};
