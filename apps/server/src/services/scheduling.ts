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
  ScheduleCreationResult,
  ScheduleDraftRecord,
  ScheduleDraftStatus,
  ScheduleHolidayRecord,
  SchedulePreviewResult,
  ScheduleSectionRecord,
} from "@api/scheduling";
import type { SchedulingPolicy } from "@api/settings";
import {
  assertValidTimeZone,
  getDatePartsInTimeZone,
  parseLocalDateTime,
} from "@api/time-zone";
import type { Database } from "@db/index";
import { courseAssessmentDefaults } from "@db/schema/curriculum";
import { classGradeComponents } from "@db/schema/grades";
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

const DEFAULT_CLASS_CAPACITY = 30;
const DIRECT_MEETING_CHUNK_SIZE = 8;
const DIRECT_REVISION_CHUNK_SIZE = 5;
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

interface CalendarDateParts {
  day: number;
  month: number;
  year: number;
}

const addCalendarDays = (
  date: CalendarDateParts,
  days: number
): CalendarDateParts => {
  const value = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    day: value.getUTCDate(),
    month: value.getUTCMonth() + 1,
    year: value.getUTCFullYear(),
  };
};

const toDateKey = ({ day, month, year }: CalendarDateParts): string =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const toLocalDate = (
  date: CalendarDateParts,
  time: string,
  timeZone: string
): Date =>
  parseLocalDateTime(
    `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}T${time}:00`,
    timeZone
  );

const parseClockTime = (value: string, label: string): number => {
  const match = /^(?<hour>\d{2}):(?<minute>\d{2})$/u.exec(value);
  if (!match) {
    throw new SchedulingDomainError(
      "INVALID_TIME_RANGE",
      `${label} harus menggunakan format HH:mm.`
    );
  }
  const hour = Number(match.groups?.hour);
  const minute = Number(match.groups?.minute);
  if (hour > 23 || minute > 59) {
    throw new SchedulingDomainError(
      "INVALID_TIME_RANGE",
      `${label} bukan waktu yang valid.`
    );
  }
  return hour * 60 + minute;
};

const getFirstWeeklyWindow = ({
  endTime,
  periodStart,
  startTime,
  dayOfWeek,
  timeZone,
}: {
  dayOfWeek: number;
  endTime: string;
  periodStart: Date;
  startTime: string;
  timeZone: string;
}): { endAt: Date; startAt: Date } => {
  const startMinutes = parseClockTime(startTime, "Jam mulai");
  const endMinutes = parseClockTime(endTime, "Jam selesai");
  if (endMinutes <= startMinutes) {
    throw new SchedulingDomainError(
      "INVALID_TIME_RANGE",
      "Jam selesai harus setelah jam mulai pada hari yang sama."
    );
  }
  const periodStartParts = getDatePartsInTimeZone(periodStart, timeZone);
  const periodStartWeekday = new Date(
    Date.UTC(
      periodStartParts.year,
      periodStartParts.month - 1,
      periodStartParts.day
    )
  ).getUTCDay();
  const normalizedPeriodWeekday = periodStartWeekday || 7;
  let firstDate = addCalendarDays(
    periodStartParts,
    (dayOfWeek - normalizedPeriodWeekday + 7) % 7
  );
  let startAt = toLocalDate(firstDate, startTime, timeZone);
  if (startAt < periodStart) {
    firstDate = addCalendarDays(firstDate, 7);
    startAt = toLocalDate(firstDate, startTime, timeZone);
  }
  return {
    endAt: toLocalDate(firstDate, endTime, timeZone),
    startAt,
  };
};

interface AcademicPeriodBlackoutRange {
  endAt: Date;
  startAt: Date;
}

const getAcademicPeriodBlackoutRanges = (period: {
  finalExamEndDate: Date | null;
  finalExamStartDate: Date | null;
  midtermEndDate: Date | null;
  midtermStartDate: Date | null;
}): AcademicPeriodBlackoutRange[] =>
  [
    {
      endAt: period.midtermEndDate,
      startAt: period.midtermStartDate,
    },
    {
      endAt: period.finalExamEndDate,
      startAt: period.finalExamStartDate,
    },
  ].flatMap((range) =>
    range.startAt && range.endAt
      ? [{ endAt: range.endAt, startAt: range.startAt }]
      : []
  );

const getWeeklyWindows = ({
  count,
  firstWindow,
}: {
  count: number;
  firstWindow: { endAt: Date; startAt: Date };
}): { endAt: Date; startAt: Date }[] =>
  Array.from({ length: count }, (_, weekIndex) => {
    const offset = weekIndex * WEEK_IN_MILLISECONDS;
    return {
      endAt: new Date(firstWindow.endAt.getTime() + offset),
      startAt: new Date(firstWindow.startAt.getTime() + offset),
    };
  });

const getInitialHolidayDates = ({
  firstWindow,
  holidays,
  timeZone,
}: {
  firstWindow: { endAt: Date; startAt: Date };
  holidays: readonly ScheduleHolidayRecord[];
  timeZone: string;
}): readonly ScheduleHolidayRecord[] => {
  const holidayByDate = new Map(
    holidays.map((holiday) => [holiday.date, holiday])
  );
  return getWeeklyWindows({ count: MEETINGS_PER_TERM, firstWindow })
    .map((window) =>
      holidayByDate.get(
        toDateKey(getDatePartsInTimeZone(window.startAt, timeZone))
      )
    )
    .filter((holiday): holiday is ScheduleHolidayRecord => Boolean(holiday));
};

export const createWeeklyMeetings = ({
  blackoutRanges,
  classSectionId,
  firstWindow,
  holidayDates,
  instructions,
  modality,
  onlineUrl,
  roomId,
  timeZone,
}: {
  blackoutRanges: readonly AcademicPeriodBlackoutRange[];
  classSectionId: string;
  firstWindow: { endAt: Date; startAt: Date };
  holidayDates?: readonly string[];
  instructions: string | null;
  modality: "OFFLINE" | "ONLINE";
  onlineUrl?: string | null;
  roomId: string | null;
  timeZone: string;
}): {
  classSectionId: string;
  endAt: Date;
  id: string;
  instructions: string | null;
  modality: "OFFLINE" | "ONLINE";
  onlineUrl: string | null;
  roomId: string | null;
  sequence: number;
  startAt: Date;
}[] => {
  const meetings: {
    classSectionId: string;
    endAt: Date;
    id: string;
    instructions: string | null;
    modality: "OFFLINE" | "ONLINE";
    onlineUrl: string | null;
    roomId: string | null;
    sequence: number;
    startAt: Date;
  }[] = [];
  const holidayDateSet = new Set(holidayDates);
  for (
    let weekIndex = 0;
    weekIndex < MEETINGS_PER_TERM * 3 && meetings.length < MEETINGS_PER_TERM;
    weekIndex += 1
  ) {
    const offset = weekIndex * WEEK_IN_MILLISECONDS;
    const startAt = new Date(firstWindow.startAt.getTime() + offset);
    const endAt = new Date(firstWindow.endAt.getTime() + offset);
    const localDate = toDateKey(getDatePartsInTimeZone(startAt, timeZone));
    if (holidayDateSet.has(localDate)) {
      continue;
    }
    if (
      blackoutRanges.some((range) =>
        timeRangesOverlap(startAt, endAt, range.startAt, range.endAt)
      )
    ) {
      continue;
    }
    meetings.push({
      classSectionId,
      endAt,
      id: createUuidV7(),
      instructions,
      modality,
      onlineUrl: onlineUrl ?? null,
      roomId,
      sequence: meetings.length + 1,
      startAt,
    });
  }
  return meetings;
};

const chunkItems = <T>(items: readonly T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

export const createSchedulingService = ({
  database,
  getNationalHolidays,
  getSchedulingPolicy,
  now = () => new Date(),
  timeZone,
}: {
  database: Database;
  getNationalHolidays?: (
    year: number
  ) => Promise<readonly ScheduleHolidayRecord[]>;
  getSchedulingPolicy: () => Promise<SchedulingPolicy>;
  now?: () => Date;
  timeZone: string;
}): SchedulingService => {
  assertValidTimeZone(timeZone);
  const fetchNationalHolidays =
    getNationalHolidays ??
    (() => Promise.resolve([] as readonly ScheduleHolidayRecord[]));
  const getNationalHolidaysForPeriod = async (period: {
    endDate: Date;
    startDate: Date;
  }): Promise<readonly ScheduleHolidayRecord[]> => {
    const startYear = getDatePartsInTimeZone(period.startDate, timeZone).year;
    const endYear = getDatePartsInTimeZone(period.endDate, timeZone).year;
    const years = Array.from(
      { length: endYear - startYear + 1 },
      (_, index) => startYear + index
    );
    try {
      const holidayRowsByYear = await Promise.all(
        years.map((year) => fetchNationalHolidays(year))
      );
      const holidayRows = holidayRowsByYear.flat();
      const startDate = toDateKey(
        getDatePartsInTimeZone(period.startDate, timeZone)
      );
      const endDate = toDateKey(
        getDatePartsInTimeZone(period.endDate, timeZone)
      );
      return [
        ...new Map(
          holidayRows
            .filter(
              (holiday) => holiday.date >= startDate && holiday.date <= endDate
            )
            .map((holiday) => [holiday.date, holiday])
        ).values(),
      ].toSorted((left, right) => left.date.localeCompare(right.date));
    } catch {
      throw new SchedulingDomainError(
        "NATIONAL_HOLIDAY_CALENDAR_UNAVAILABLE",
        "Kalender libur nasional belum tersedia untuk seluruh rentang periode akademik. Perbarui kalender nasional lalu coba lagi."
      );
    }
  };
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
          id: createUuidV7(),
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
          id: createUuidV7(),
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
      eq(students.status, "ACTIVE"),
      eq(students.academicStatus, "ACTIVE"),
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
    const jobId = existingJob?.id ?? createUuidV7();
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
              id: createUuidV7(),
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
          // Components must be persisted before the mapping checkpoint advances.
          // eslint-disable-next-line no-await-in-loop
          const assessmentDefaults = await database
            .select()
            .from(courseAssessmentDefaults)
            .where(eq(courseAssessmentDefaults.courseId, first.courseId))
            .orderBy(asc(courseAssessmentDefaults.createdAt));
          const components = assessmentDefaults.length
            ? assessmentDefaults
            : [
                {
                  componentCode: "NILAI_AKHIR",
                  label: "Nilai akhir",
                  weight: 100,
                },
              ];
          // eslint-disable-next-line no-await-in-loop
          await database
            .insert(classGradeComponents)
            .values(
              components.map((component, sortOrder) => ({
                classSectionId: section.id,
                componentCode: component.componentCode,
                createdAt: now(),
                id: createUuidV7(),
                label: component.label,
                sortOrder,
                weight: component.weight,
              }))
            )
            .onConflictDoNothing();
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
                id: createUuidV7(),
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
                        id: createUuidV7(),
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
        academicPeriodId: section.academicPeriodId,
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

  const previewSchedule: SchedulingService["previewSchedule"] = async ({
    actorRoles,
    actorUserId: _actorUserId,
    classSectionId,
    dayOfWeek,
    endTime,
    startTime,
  }): Promise<SchedulePreviewResult> => {
    requireAcademicManager(actorRoles);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
      throw new SchedulingDomainError(
        "INVALID_DAY_OF_WEEK",
        "Hari jadwal harus berada antara Senin dan Minggu."
      );
    }
    const [sectionRow] = await database
      .select({
        period: academicPeriods,
        section: classSections,
      })
      .from(classSections)
      .innerJoin(
        academicPeriods,
        eq(academicPeriods.id, classSections.academicPeriodId)
      )
      .where(eq(classSections.id, classSectionId))
      .limit(1);
    if (!sectionRow) {
      throw new SchedulingDomainError(
        "CLASS_SECTION_NOT_FOUND",
        "Kelas kuliah tidak ditemukan."
      );
    }
    if (sectionRow.period.status !== "ACTIVE") {
      throw new SchedulingDomainError(
        "ACADEMIC_PERIOD_NOT_ACTIVE",
        "Jadwal hanya dapat dibuat pada periode akademik yang aktif."
      );
    }
    if (sectionRow.section.status === "PUBLISHED") {
      throw new SchedulingDomainError(
        "CLASS_ALREADY_PUBLISHED",
        "Kelas kuliah ini sudah memiliki jadwal yang diterbitkan."
      );
    }
    const firstWindow = getFirstWeeklyWindow({
      dayOfWeek,
      endTime,
      periodStart: sectionRow.period.startDate,
      startTime,
      timeZone,
    });
    const nationalHolidays = await getNationalHolidaysForPeriod(
      sectionRow.period
    );
    const initialHolidayRows = getInitialHolidayDates({
      firstWindow,
      holidays: nationalHolidays,
      timeZone,
    });
    const meetingValues = createWeeklyMeetings({
      blackoutRanges: getAcademicPeriodBlackoutRanges(sectionRow.period),
      classSectionId,
      firstWindow,
      holidayDates: nationalHolidays.map((holiday) => holiday.date),
      instructions: null,
      modality: "ONLINE",
      roomId: null,
      timeZone,
    });
    const lastMeeting = meetingValues.at(-1);
    if (
      !lastMeeting ||
      firstWindow.startAt < sectionRow.period.startDate ||
      lastMeeting.endAt > sectionRow.period.endDate
    ) {
      throw new SchedulingDomainError(
        "SCHEDULE_OUTSIDE_PERIOD",
        "Rentang 16 pertemuan harus berada di dalam periode akademik."
      );
    }
    return {
      holidayCount: initialHolidayRows.length,
      holidays: initialHolidayRows,
      initialMeetingCount: MEETINGS_PER_TERM,
      meetingCount: meetingValues.length,
      shiftedMeetingCount: initialHolidayRows.length,
    };
  };

  // eslint-disable-next-line complexity -- direct scheduling validates all resources before one atomic write.
  const createSchedule: SchedulingService["createSchedule"] = async ({
    actorRoles,
    actorUserId,
    classSectionId,
    dayOfWeek,
    endTime,
    instructions,
    lecturerIds,
    modality,
    roomId,
    startTime,
  }): Promise<ScheduleCreationResult> => {
    requireAcademicManager(actorRoles);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
      throw new SchedulingDomainError(
        "INVALID_DAY_OF_WEEK",
        "Hari jadwal harus berada antara Senin dan Minggu."
      );
    }
    const normalizedLecturerIds = unique(lecturerIds);
    if (
      normalizedLecturerIds.length < 1 ||
      normalizedLecturerIds.length > 2 ||
      normalizedLecturerIds.length !== lecturerIds.length
    ) {
      throw new SchedulingDomainError(
        "INVALID_LECTURER_ASSIGNMENTS",
        "Pilih satu atau dua dosen pengampu yang berbeda."
      );
    }
    const [sectionRow] = await database
      .select({
        course: courses,
        period: academicPeriods,
        section: classSections,
      })
      .from(classSections)
      .innerJoin(courses, eq(courses.id, classSections.courseId))
      .innerJoin(
        academicPeriods,
        eq(academicPeriods.id, classSections.academicPeriodId)
      )
      .where(eq(classSections.id, classSectionId))
      .limit(1);
    if (!sectionRow) {
      throw new SchedulingDomainError(
        "CLASS_SECTION_NOT_FOUND",
        "Kelas kuliah tidak ditemukan."
      );
    }
    if (sectionRow.period.status !== "ACTIVE") {
      throw new SchedulingDomainError(
        "ACADEMIC_PERIOD_NOT_ACTIVE",
        "Jadwal hanya dapat dibuat pada periode akademik yang aktif."
      );
    }
    if (sectionRow.section.status === "PUBLISHED") {
      throw new SchedulingDomainError(
        "CLASS_ALREADY_PUBLISHED",
        "Kelas kuliah ini sudah memiliki jadwal yang diterbitkan."
      );
    }
    const firstWindow = getFirstWeeklyWindow({
      dayOfWeek,
      endTime,
      periodStart: sectionRow.period.startDate,
      startTime,
      timeZone,
    });
    const nationalHolidays = await getNationalHolidaysForPeriod(
      sectionRow.period
    );
    const initialHolidayRows = getInitialHolidayDates({
      firstWindow,
      holidays: nationalHolidays,
      timeZone,
    });
    const meetingValues = createWeeklyMeetings({
      blackoutRanges: getAcademicPeriodBlackoutRanges(sectionRow.period),
      classSectionId,
      firstWindow,
      holidayDates: nationalHolidays.map((holiday) => holiday.date),
      instructions: instructions?.trim() || null,
      modality,
      onlineUrl: null,
      roomId: modality === "OFFLINE" ? (roomId ?? null) : null,
      timeZone,
    });
    const lastMeeting = meetingValues.at(-1);
    if (
      !lastMeeting ||
      firstWindow.startAt < sectionRow.period.startDate ||
      lastMeeting.endAt > sectionRow.period.endDate
    ) {
      throw new SchedulingDomainError(
        "SCHEDULE_OUTSIDE_PERIOD",
        "Rentang 16 pertemuan harus berada di dalam periode akademik."
      );
    }
    if (modality === "OFFLINE" && !roomId) {
      throw new SchedulingDomainError(
        "ROOM_REQUIRED",
        "Jadwal luring memerlukan ruang."
      );
    }
    if (modality === "ONLINE" && roomId) {
      throw new SchedulingDomainError(
        "ROOM_NOT_ALLOWED",
        "Jadwal daring tidak boleh menggunakan ruang luring."
      );
    }
    const [
      lecturerRows,
      roomRows,
      enrollmentRows,
      existingSectionMeetings,
      existingSectionSlots,
    ] = await Promise.all([
      database
        .select()
        .from(lecturers)
        .where(inArray(lecturers.id, normalizedLecturerIds)),
      roomId
        ? database.select().from(rooms).where(eq(rooms.id, roomId)).limit(1)
        : Promise.resolve([]),
      database
        .select({ studentId: classEnrollments.studentId })
        .from(classEnrollments)
        .where(eq(classEnrollments.classSectionId, classSectionId)),
      database
        .select({ id: classMeetings.id })
        .from(classMeetings)
        .where(eq(classMeetings.classSectionId, classSectionId))
        .limit(1),
      database
        .select({ id: scheduleSlots.id })
        .from(scheduleSlots)
        .innerJoin(
          scheduleDrafts,
          eq(scheduleDrafts.id, scheduleSlots.scheduleDraftId)
        )
        .where(
          and(
            eq(scheduleSlots.classSectionId, classSectionId),
            inArray(scheduleDrafts.status, [
              "DRAFT",
              "SUBMITTED",
              "APPROVED",
              "PUBLISHED",
            ])
          )
        )
        .limit(1),
    ]);
    if (lecturerRows.length !== normalizedLecturerIds.length) {
      throw new SchedulingDomainError(
        "LECTURER_NOT_FOUND",
        "Salah satu dosen pengampu tidak ditemukan."
      );
    }
    if (
      lecturerRows.some(
        (lecturer) =>
          lecturer.status !== "ACTIVE" || lecturer.academicStatus !== "ACTIVE"
      )
    ) {
      throw new SchedulingDomainError(
        "INACTIVE_LECTURER",
        "Semua dosen pengampu harus berstatus aktif."
      );
    }
    const [room] = roomRows;
    if (modality === "OFFLINE") {
      if (!room || room.status !== "ACTIVE") {
        throw new SchedulingDomainError(
          "INACTIVE_ROOM",
          "Ruang yang dipilih tidak ditemukan atau tidak aktif."
        );
      }
      if (room.capacity < enrollmentRows.length) {
        throw new SchedulingDomainError(
          "ROOM_CAPACITY",
          `Kapasitas ruang ${room.capacity} kurang dari ${enrollmentRows.length} mahasiswa.`
        );
      }
    }
    if (existingSectionMeetings.length || existingSectionSlots.length) {
      throw new SchedulingDomainError(
        "CLASS_ALREADY_SCHEDULED",
        "Kelas kuliah ini sudah memiliki jadwal atau draft jadwal."
      );
    }

    const [firstMeeting] = meetingValues;
    const firstStartAt = firstMeeting?.startAt;
    const lastEndAt = lastMeeting.endAt;
    if (!firstStartAt) {
      throw new SchedulingDomainError(
        "SCHEDULE_UNAVAILABLE",
        "Jadwal pertemuan belum dapat dibentuk."
      );
    }
    const [
      existingMeetings,
      existingLecturerMeetings,
      existingStudentMeetings,
      existingExamSchedules,
    ] = await Promise.all([
      database
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
        .where(
          and(
            lte(classMeetings.startAt, lastEndAt),
            gt(classMeetings.endAt, firstStartAt)
          )
        ),
      database
        .select({
          courseName: courses.name,
          lecturerId: teachingAssignments.lecturerId,
          meeting: classMeetings,
          section: classSections,
        })
        .from(teachingAssignments)
        .innerJoin(
          classMeetings,
          eq(classMeetings.classSectionId, teachingAssignments.classSectionId)
        )
        .innerJoin(
          classSections,
          eq(classSections.id, classMeetings.classSectionId)
        )
        .innerJoin(courses, eq(courses.id, classSections.courseId))
        .where(
          and(
            inArray(teachingAssignments.lecturerId, normalizedLecturerIds),
            lte(classMeetings.startAt, lastEndAt),
            gt(classMeetings.endAt, firstStartAt)
          )
        ),
      enrollmentRows.length
        ? database
            .select({
              courseName: courses.name,
              meeting: classMeetings,
              section: classSections,
              studentId: classEnrollments.studentId,
            })
            .from(classEnrollments)
            .innerJoin(
              classMeetings,
              eq(classMeetings.classSectionId, classEnrollments.classSectionId)
            )
            .innerJoin(
              classSections,
              eq(classSections.id, classMeetings.classSectionId)
            )
            .innerJoin(courses, eq(courses.id, classSections.courseId))
            .where(
              and(
                inArray(
                  classEnrollments.studentId,
                  enrollmentRows.map((row) => row.studentId)
                ),
                lte(classMeetings.startAt, lastEndAt),
                gt(classMeetings.endAt, firstStartAt)
              )
            )
        : Promise.resolve([]),
      roomId
        ? database
            .select()
            .from(examSchedules)
            .where(
              and(
                eq(examSchedules.roomId, roomId),
                lte(examSchedules.startAt, lastEndAt),
                gt(examSchedules.endAt, firstStartAt)
              )
            )
        : Promise.resolve([]),
    ]);
    const hasOverlap = (meeting: { endAt: Date; startAt: Date }): boolean =>
      meetingValues.some((candidate) =>
        timeRangesOverlap(
          candidate.startAt,
          candidate.endAt,
          meeting.startAt,
          meeting.endAt
        )
      );
    const roomConflict = existingMeetings.find(
      (row) => row.meeting.roomId === roomId && hasOverlap(row.meeting)
    );
    if (roomConflict) {
      throw new SchedulingDomainError(
        "ROOM_SCHEDULE_CONFLICT",
        `Ruang bentrok dengan ${roomConflict.courseName} kelas ${roomConflict.section.code}.`
      );
    }
    const lecturerConflict = existingLecturerMeetings.find((row) =>
      hasOverlap(row.meeting)
    );
    if (lecturerConflict) {
      throw new SchedulingDomainError(
        "LECTURER_SCHEDULE_CONFLICT",
        `Dosen pengampu bentrok dengan ${lecturerConflict.courseName} kelas ${lecturerConflict.section.code}.`
      );
    }
    const studentConflict = existingStudentMeetings.find((row) =>
      hasOverlap(row.meeting)
    );
    if (studentConflict) {
      throw new SchedulingDomainError(
        "STUDENT_SCHEDULE_CONFLICT",
        `Sebagian mahasiswa sudah memiliki jadwal pada ${studentConflict.courseName} kelas ${studentConflict.section.code}.`
      );
    }
    if (existingExamSchedules.some((exam) => hasOverlap(exam))) {
      throw new SchedulingDomainError(
        "EXAM_SCHEDULE_CONFLICT",
        "Ruang bentrok dengan jadwal ujian pada rentang waktu tersebut."
      );
    }

    const currentTime = now();
    const draftId = createUuidV7();
    const slotId = createUuidV7();
    const assignmentRows = normalizedLecturerIds.map((lecturerId, index) => ({
      classSectionId,
      createdAt: currentTime,
      id: createUuidV7(),
      isPrimary: index === 0,
      lecturerId,
    }));
    const revisionRows = meetingValues.map((meeting) => ({
      changeRequestId: null,
      changedBy: actorUserId,
      createdAt: currentTime,
      effectiveFrom: currentTime,
      effectiveUntil: null,
      endAt: meeting.endAt,
      id: createUuidV7(),
      instructions: meeting.instructions,
      meetingId: meeting.id,
      modality: meeting.modality,
      onlineUrl: null,
      reason: "Jadwal awal dibuat langsung dari kelas kuliah.",
      roomId: meeting.roomId,
      startAt: meeting.startAt,
      version: 1,
    }));
    const statements = [
      database
        .delete(teachingAssignments)
        .where(eq(teachingAssignments.classSectionId, classSectionId)),
      database.insert(teachingAssignments).values(assignmentRows),
      database.insert(scheduleDrafts).values({
        academicPeriodId: sectionRow.section.academicPeriodId,
        approvedAt: currentTime,
        approvedBy: actorUserId,
        createdAt: currentTime,
        createdBy: actorUserId,
        id: draftId,
        publishedAt: currentTime,
        publishedBy: actorUserId,
        rejectionReason: null,
        status: "PUBLISHED",
        studyProgramId: sectionRow.section.studyProgramId,
        submittedAt: currentTime,
        submittedBy: actorUserId,
        updatedAt: currentTime,
        version: 1,
      }),
      database.insert(scheduleSlots).values({
        classSectionId,
        createdAt: currentTime,
        endAt: firstWindow.endAt,
        id: slotId,
        instructions: instructions?.trim() || null,
        modality,
        onlineUrl: null,
        roomId: modality === "OFFLINE" ? (roomId ?? null) : null,
        scheduleDraftId: draftId,
        startAt: firstWindow.startAt,
        updatedAt: currentTime,
      }),
      ...chunkItems(meetingValues, DIRECT_MEETING_CHUNK_SIZE).map((rows) =>
        database.insert(classMeetings).values(rows)
      ),
      ...chunkItems(revisionRows, DIRECT_REVISION_CHUNK_SIZE).map((rows) =>
        database.insert(scheduleRevisions).values(rows)
      ),
      database
        .update(classSections)
        .set({
          status: "PUBLISHED",
          updatedAt: currentTime,
          version: sectionRow.section.version + 1,
        })
        .where(eq(classSections.id, classSectionId)),
      database.insert(auditLogs).values({
        action: "CREATE",
        actorUserId,
        afterState: JSON.stringify({
          dayOfWeek,
          endTime,
          lecturerIds: normalizedLecturerIds,
          modality,
          roomId: roomId ?? null,
          startTime,
          status: "PUBLISHED",
        }),
        beforeState: JSON.stringify({ status: sectionRow.section.status }),
        createdAt: currentTime,
        entityId: classSectionId,
        entityType: "CLASS_SCHEDULE",
        id: createUuidV7(),
        metadata: JSON.stringify({ draftId }),
        requestId: null,
      }),
    ];
    // All schedule state changes are in one D1 batch. Validation above performs no writes.
    await database.batch(
      statements as unknown as Parameters<Database["batch"]>[0]
    );
    await notifyClassParticipants({
      body: "Jadwal kelas telah dibuat. Periksa rincian waktu dan ruang terbaru.",
      classSectionId,
      route: "/mahasiswa/jadwal",
      title: "Jadwal kelas dibuat",
      type: "SCHEDULE_PUBLISHED",
    });
    return {
      holidayCount: initialHolidayRows.length,
      holidayDates: initialHolidayRows.map((holiday) => holiday.date),
      meetingCount: meetingValues.length,
      status: "PUBLISHED",
    };
  };

  const createDraft: SchedulingService["createDraft"] = async ({
    academicPeriodId,
    actorRoles,
    actorUserId,
    studyProgramId,
  }) => {
    requireAcademicManager(actorRoles);
    const id = createUuidV7();
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
    const slotId = existing?.id ?? createUuidV7();
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
      id: createUuidV7(),
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
    const conflictCount = await refreshConflicts(draft);
    if (conflictCount > 0) {
      throw new SchedulingDomainError(
        "BLOCKING_CONFLICTS",
        "Jadwal memiliki konflik baru dan belum dapat diterbitkan. Muat ulang draft untuk melihat detailnya."
      );
    }
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
    const [period] = await database
      .select()
      .from(academicPeriods)
      .where(eq(academicPeriods.id, draft.academicPeriodId))
      .limit(1);
    if (!period) {
      throw new SchedulingDomainError(
        "ACADEMIC_PERIOD_NOT_FOUND",
        "Periode akademik tidak ditemukan."
      );
    }
    const nationalHolidays = await getNationalHolidaysForPeriod(period);
    const meetingValuesBySlot = slots.map((slot) => {
      const meetingValues = createWeeklyMeetings({
        blackoutRanges: getAcademicPeriodBlackoutRanges(period),
        classSectionId: slot.classSectionId,
        firstWindow: { endAt: slot.endAt, startAt: slot.startAt },
        holidayDates: nationalHolidays.map((holiday) => holiday.date),
        instructions: slot.instructions,
        modality: slot.modality as "OFFLINE" | "ONLINE",
        onlineUrl: slot.onlineUrl,
        roomId: slot.roomId,
        timeZone,
      });
      const lastMeeting = meetingValues.at(-1);
      if (!lastMeeting || lastMeeting.endAt > period.endDate) {
        throw new SchedulingDomainError(
          "SCHEDULE_OUTSIDE_PERIOD",
          "Rentang 16 pertemuan harus berada di dalam periode akademik setelah masa UTS dan UAS dikecualikan."
        );
      }
      return { meetingValues, slot };
    });
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
    for (const { meetingValues, slot } of meetingValuesBySlot) {
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
          id: createUuidV7(),
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
      id: createUuidV7(),
      metadata: JSON.stringify({ action: "PUBLISH" }),
    });
    return { status: "PUBLISHED" };
  };

  const listNationalHolidays: SchedulingService["listNationalHolidays"] =
    async ({ actorRoles, actorUserId: _actorUserId, year }) => {
      assertSchedulingReadRole(actorRoles);
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        throw new SchedulingDomainError(
          "INVALID_CALENDAR_YEAR",
          "Tahun kalender harus berada antara 2000 dan 2100."
        );
      }
      try {
        return await fetchNationalHolidays(year);
      } catch {
        throw new SchedulingDomainError(
          "NATIONAL_HOLIDAY_CALENDAR_UNAVAILABLE",
          `Kalender nasional tahun ${year} belum tersedia atau tidak dapat dimuat. Coba lagi setelah data kalender tahun tersebut tersedia.`
        );
      }
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
        timeZone
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
      id: createUuidV7(),
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
          timeZone
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
      const requestId = createUuidV7();
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
        timeZone
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
      id: createUuidV7(),
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
    createSchedule,
    decideDraft,
    decideOfflineChange,
    detailDraft,
    generateMapping,
    listChangeRequests,
    listDrafts,
    listMeetings,
    listNationalHolidays,
    listSections,
    previewSchedule,
    publishDraft,
    requestOfflineChange,
    submitDraft,
    updateMeetingOnline,
    upsertSlot,
  };
};
