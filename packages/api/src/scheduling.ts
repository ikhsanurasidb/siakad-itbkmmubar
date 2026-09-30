import type { RoleKey } from "@api/identity";
import { getDatePartsInTimeZone } from "@api/time-zone";

export const scheduleDraftStatuses = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "PUBLISHED",
] as const;
export type ScheduleDraftStatus = (typeof scheduleDraftStatuses)[number];

export const scheduleModalities = ["OFFLINE", "ONLINE"] as const;
export type ScheduleModality = (typeof scheduleModalities)[number];

export const scheduleChangeRequestStatuses = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;
export type ScheduleChangeRequestStatus =
  (typeof scheduleChangeRequestStatuses)[number];

export const scheduleConflictTypes = [
  "STUDENT_OVERLAP",
  "LECTURER_OVERLAP",
  "ROOM_OVERLAP",
  "EXAM_OVERLAP",
  "ROOM_CAPACITY",
  "INACTIVE_LECTURER",
  "INACTIVE_ROOM",
  "OUTSIDE_PERIOD",
  "INCOMPLETE_MODALITY",
] as const;
export type ScheduleConflictType = (typeof scheduleConflictTypes)[number];

export class SchedulingDomainError extends Error {
  readonly code: string;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;

  constructor(
    code: string,
    message: string,
    fieldErrors: Readonly<Record<string, readonly string[]>> = {}
  ) {
    super(message);
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.name = "SchedulingDomainError";
  }
}

interface LocalDateParts {
  day: number;
  month: number;
  year: number;
}

const toCalendarDay = ({ day, month, year }: LocalDateParts): number =>
  Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);

/**
 * Applies the inclusive calendar-day cutoff in the supplied business timezone.
 * For a class on day 7 and a seven-day policy, the final allowed day is day 1.
 */
export const canChangeMeeting = (
  classStartAt: Date,
  requestAt: Date,
  policy: { leadDays: number },
  timezone: string
): boolean => {
  if (!Number.isInteger(policy.leadDays) || policy.leadDays < 1) {
    throw new SchedulingDomainError(
      "INVALID_LEAD_DAYS",
      "Batas hari perubahan jadwal tidak valid."
    );
  }
  if (
    Number.isNaN(classStartAt.getTime()) ||
    Number.isNaN(requestAt.getTime())
  ) {
    throw new SchedulingDomainError(
      "INVALID_DATE",
      "Tanggal penjadwalan tidak valid."
    );
  }
  let classDateParts: LocalDateParts;
  let requestDateParts: LocalDateParts;
  try {
    classDateParts = getDatePartsInTimeZone(classStartAt, timezone);
    requestDateParts = getDatePartsInTimeZone(requestAt, timezone);
  } catch {
    throw new SchedulingDomainError(
      "INVALID_TIMEZONE",
      "Zona waktu penjadwalan tidak valid."
    );
  }
  const classDay = toCalendarDay(classDateParts);
  const requestDay = toCalendarDay(requestDateParts);
  return requestDay <= classDay - (policy.leadDays - 1);
};

export const timeRangesOverlap = (
  firstStart: Date,
  firstEnd: Date,
  secondStart: Date,
  secondEnd: Date
): boolean => {
  const firstStartTime = firstStart.getTime();
  const firstEndTime = firstEnd.getTime();
  const secondStartTime = secondStart.getTime();
  const secondEndTime = secondEnd.getTime();
  const values = [firstStartTime, firstEndTime, secondStartTime, secondEndTime];
  if (
    values.some(Number.isNaN) ||
    firstEndTime <= firstStartTime ||
    secondEndTime <= secondStartTime
  ) {
    throw new SchedulingDomainError(
      "INVALID_TIME_RANGE",
      "Rentang waktu jadwal tidak valid."
    );
  }
  return firstStartTime < secondEndTime && secondStartTime < firstEndTime;
};

export const splitEnrollmentIds = (
  enrollmentIds: readonly string[],
  capacity: number
): readonly (readonly string[])[] => {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new SchedulingDomainError(
      "INVALID_CLASS_CAPACITY",
      "Kapasitas kelas harus berupa bilangan positif."
    );
  }
  const sections: string[][] = [];
  for (let index = 0; index < enrollmentIds.length; index += capacity) {
    sections.push(enrollmentIds.slice(index, index + capacity));
  }
  return sections;
};

export const assertScheduleTransition = (
  from: ScheduleDraftStatus,
  to: ScheduleDraftStatus,
  options: { hasBlockingConflicts?: boolean; rejectionReason?: string } = {}
): void => {
  const valid =
    (from === "DRAFT" && to === "SUBMITTED") ||
    (from === "REJECTED" && to === "DRAFT") ||
    (from === "SUBMITTED" && (to === "APPROVED" || to === "REJECTED")) ||
    (from === "APPROVED" && to === "PUBLISHED");
  if (!valid) {
    throw new SchedulingDomainError(
      "INVALID_SCHEDULE_TRANSITION",
      `Perubahan status jadwal ${from} ke ${to} tidak diizinkan.`
    );
  }
  if (to === "SUBMITTED" && options.hasBlockingConflicts) {
    throw new SchedulingDomainError(
      "BLOCKING_CONFLICTS",
      "Selesaikan seluruh konflik penghambat sebelum mengajukan jadwal."
    );
  }
  if (to === "REJECTED" && !options.rejectionReason?.trim()) {
    throw new SchedulingDomainError(
      "REJECTION_REASON_REQUIRED",
      "Alasan penolakan jadwal wajib diisi.",
      { reason: ["Masukkan alasan penolakan."] }
    );
  }
};

export const assertOnlineMeetingChange = ({
  currentOnlineMeetings,
  instructions,
  maximumOnlineMeetings,
  onlineUrl,
}: {
  currentOnlineMeetings: number;
  instructions?: string | null;
  maximumOnlineMeetings: number;
  onlineUrl?: string | null;
}): void => {
  if (currentOnlineMeetings >= maximumOnlineMeetings) {
    throw new SchedulingDomainError(
      "ONLINE_MEETING_LIMIT_REACHED",
      `Batas ${maximumOnlineMeetings} pertemuan daring untuk kelas ini telah tercapai.`
    );
  }
  if (!onlineUrl?.trim() && !instructions?.trim()) {
    throw new SchedulingDomainError(
      "ONLINE_MEETING_DETAILS_REQUIRED",
      "Pertemuan daring memerlukan tautan atau instruksi akses.",
      { onlineUrl: ["Masukkan tautan atau instruksi akses."] }
    );
  }
  if (onlineUrl) {
    try {
      const url = new URL(onlineUrl);
      if (url.protocol !== "https:") {
        throw new Error("Unsupported protocol");
      }
    } catch {
      throw new SchedulingDomainError(
        "INVALID_ONLINE_URL",
        "Tautan pertemuan daring harus menggunakan HTTPS.",
        { onlineUrl: ["Gunakan tautan HTTPS yang valid."] }
      );
    }
  }
};

export const normalizeScheduleReason = (reason: string): string => {
  const normalized = reason.trim().replaceAll(/\s+/gu, " ");
  if (normalized.length < 10 || normalized.length > 500) {
    throw new SchedulingDomainError(
      "INVALID_REASON",
      "Alasan harus terdiri dari 10–500 karakter.",
      { reason: ["Masukkan alasan 10–500 karakter."] }
    );
  }
  return normalized;
};

export const assertSchedulingReadRole = (roles: readonly RoleKey[]): void => {
  if (
    !roles.some((role) =>
      [
        "SUPERADMIN",
        "ADMIN_AKADEMIK",
        "KAPRODI",
        "DOSEN",
        "MAHASISWA",
      ].includes(role)
    )
  ) {
    throw new SchedulingDomainError(
      "SCHEDULE_ACCESS_DENIED",
      "Peran Anda tidak memiliki akses ke jadwal."
    );
  }
};

export interface ScheduleConflictRecord {
  classSectionId: string | null;
  conflictType: ScheduleConflictType;
  endAt: string | null;
  entityIds: readonly string[];
  id: string;
  message: string;
  resolvedAt: string | null;
  severity: "BLOCKING" | "WARNING";
  startAt: string | null;
}

export interface ScheduleSectionRecord {
  academicPeriodId: string;
  capacity: number;
  code: string;
  courseCode: string;
  courseName: string;
  enrolledCount: number;
  id: string;
  lecturerNames: readonly string[];
  policyLeadDays: number;
  policyMaxOnlineMeetings: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "PUBLISHED";
  studyProgramId: string;
}

export interface ScheduleDraftRecord {
  academicPeriodId: string;
  conflicts: readonly ScheduleConflictRecord[];
  id: string;
  slots: readonly ScheduleSlotRecord[];
  status: ScheduleDraftStatus;
  studyProgramId: string;
  version: number;
}

export interface ScheduleSlotRecord {
  classSectionId: string;
  endAt: string;
  id: string;
  instructions: string | null;
  modality: ScheduleModality;
  onlineUrl: string | null;
  roomId: string | null;
  startAt: string;
}

export interface ClassMeetingRecord extends ScheduleSlotRecord {
  classCode: string;
  courseName: string;
  sequence: number;
  version: number;
}

export interface ScheduleHolidayRecord {
  date: string;
  isJointLeave: boolean;
  name: string;
  source: "OFFICIAL_FALLBACK" | "PUBLIC_API";
  sourceUrl: string;
}

export interface ClassMappingResult {
  completedCount: number;
  errorCount: number;
  jobId: string;
  processedCount: number;
  status: "COMPLETED" | "PARTIAL_FAILED";
  totalCount: number;
}

export interface ScheduleCreationResult {
  holidayCount: number;
  holidayDates: readonly string[];
  meetingCount: number;
  status: "PUBLISHED";
}

export interface SchedulePreviewResult {
  holidayCount: number;
  holidays: readonly ScheduleHolidayRecord[];
  initialMeetingCount: number;
  meetingCount: number;
  shiftedMeetingCount: number;
}

export interface ScheduleChangeRequestRecord {
  classCode: string;
  createdAt: string;
  id: string;
  meetingId: string;
  proposedEndAt: string;
  proposedRoomId: string;
  proposedStartAt: string;
  reason: string;
  status: ScheduleChangeRequestStatus;
}
