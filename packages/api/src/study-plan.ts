import type { RoleKey } from "@api/identity";

export const studyPlanModes = ["PACKAGE", "FREE"] as const;
export type StudyPlanMode = (typeof studyPlanModes)[number];

export const studyPlanStatuses = ["DRAFT", "FINAL"] as const;
export type StudyPlanStatus = (typeof studyPlanStatuses)[number];

export type StudyPlanHistoryAction = "GENERATE" | "FINALIZE" | "REOPEN";

export const studyPlanFailureReasonCodes = [
  "CURRICULUM_NOT_FOUND",
  "CURRICULUM_EMPTY",
  "CURRICULUM_SEMESTER_EMPTY",
  "CURRICULUM_DUPLICATE_COURSE",
  "CURRICULUM_COURSE_INVALID",
  "CURRICULUM_COURSE_INACTIVE",
  "SEMESTER_TRACKER_UNAVAILABLE",
  "GENERATION_FAILED",
] as const;
export type StudyPlanFailureReasonCode =
  (typeof studyPlanFailureReasonCodes)[number];

export interface StudyPlanItemDraft {
  courseId: string;
  credits: number;
  curriculumCourseId: string | null;
  semester: number;
  sortOrder: number;
  source: string;
}

export interface PackageStudyPlanInput {
  courses: readonly {
    courseId: string;
    credits: number;
    curriculumCourseId: string;
    semester: number;
    sortOrder: number;
  }[];
}

export interface StudyPlanStrategy {
  readonly mode: StudyPlanMode;
  generate: (input: PackageStudyPlanInput) => readonly StudyPlanItemDraft[];
}

export const filterCoursesForSemester = <T extends { semester: number }>(
  courses: readonly T[],
  semesterNumber: number
): readonly T[] =>
  courses.filter((course) => course.semester === semesterNumber);

export interface StudyPlanFailure {
  action: string;
  message: string;
  nim: string;
  reasonCode: StudyPlanFailureReasonCode;
  studentId: string;
}

export const studentSemesterTrackerSources = ["AUTO", "MANUAL"] as const;
export type StudentSemesterTrackerSource =
  (typeof studentSemesterTrackerSources)[number];

export interface StudentSemesterTrackerRecord {
  entryYear: number;
  semesterNumber: number | null;
  source: StudentSemesterTrackerSource;
  student: {
    id: string;
    name: string;
    nim: string;
  };
}

export const deriveStudentSemester = ({
  academicYearStartYear,
  cohortEntryYear,
  term,
}: {
  academicYearStartYear: number;
  cohortEntryYear: number;
  term: string;
}): number | null => {
  if (term !== "ODD" && term !== "EVEN") {
    return null;
  }
  const academicYearOffset = academicYearStartYear - cohortEntryYear;
  if (academicYearOffset < 0) {
    return null;
  }
  const semesterNumber = academicYearOffset * 2 + (term === "ODD" ? 1 : 2);
  return semesterNumber >= 1 && semesterNumber <= 8 ? semesterNumber : null;
};

export const getStudyPlanFailureAction = (
  reasonCode: StudyPlanFailureReasonCode
): string => {
  switch (reasonCode) {
    case "CURRICULUM_NOT_FOUND": {
      return "Buka Master Data > Kurikulum, buat atau aktifkan kurikulum untuk Prodi dan angkatan mahasiswa, lalu jalankan ulang.";
    }
    case "CURRICULUM_EMPTY": {
      return "Buka kurikulum aktif tersebut dan tambahkan minimal satu mata kuliah sebelum menjalankan ulang.";
    }
    case "CURRICULUM_SEMESTER_EMPTY": {
      return "Buka kurikulum aktif tersebut dan tambahkan mata kuliah untuk semester berjalan mahasiswa, lalu jalankan ulang.";
    }
    case "CURRICULUM_DUPLICATE_COURSE": {
      return "Buka kurikulum aktif tersebut dan hapus mata kuliah yang tercantum lebih dari sekali, lalu jalankan ulang.";
    }
    case "CURRICULUM_COURSE_INVALID": {
      return "Perbaiki semester menjadi 1–8 dan SKS menjadi 1–6 pada mata kuliah kurikulum, lalu jalankan ulang.";
    }
    case "CURRICULUM_COURSE_INACTIVE": {
      return "Aktifkan kembali mata kuliah tersebut atau keluarkan dari kurikulum aktif, lalu jalankan ulang.";
    }
    case "SEMESTER_TRACKER_UNAVAILABLE": {
      return "Periksa angkatan dan tahun akademik periode. Jika mahasiswa tidak mengikuti semester normal, atur semester berjalan secara manual pada tracker lalu jalankan ulang.";
    }
    case "GENERATION_FAILED": {
      return "Buat job baru setelah memeriksa data kurikulum. Jika masih gagal, minta administrator memeriksa log server dengan NIM mahasiswa.";
    }
    default: {
      return "Periksa data kurikulum dan jalankan ulang pembuatan KRS.";
    }
  }
};

export interface StudyPlanListItem {
  academicPeriod: {
    endDate: string;
    id: string;
    startDate: string;
    term: string;
  };
  id: string;
  mode: StudyPlanMode;
  status: StudyPlanStatus;
  student: {
    id: string;
    name: string;
    nim: string;
    studyProgramId: string;
  };
  totalCredits: number;
  totalCourses: number;
  updatedAt: string;
}

export interface StudyPlanRecord extends StudyPlanListItem {
  curriculumId: string | null;
  histories: readonly {
    action: StudyPlanHistoryAction;
    createdAt: string;
    fromStatus: StudyPlanStatus | null;
    id: string;
    reason: string | null;
    toStatus: StudyPlanStatus | null;
  }[];
  items: readonly (StudyPlanItemDraft & {
    courseCode: string;
    courseName: string;
    id: string;
  })[];
  version: number;
}

export interface StudyPlanGenerationResult {
  completedCount: number;
  errorCount: number;
  failures: readonly StudyPlanFailure[];
  jobId: string;
  processedCount: number;
  status: "COMPLETED" | "PARTIAL_FAILED";
  totalCount: number;
}

export class StudyPlanDomainError extends Error {
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
    this.name = "StudyPlanDomainError";
  }
}

export const packageStudyPlanStrategy: StudyPlanStrategy = {
  generate: ({ courses }) =>
    courses.map((course) => ({
      courseId: course.courseId,
      credits: course.credits,
      curriculumCourseId: course.curriculumCourseId,
      semester: course.semester,
      sortOrder: course.sortOrder,
      source: "PACKAGE",
    })),
  mode: "PACKAGE",
};

export const studyPlanStrategies: Readonly<
  Record<StudyPlanMode, StudyPlanStrategy>
> = {
  FREE: {
    generate: () => {
      throw new StudyPlanDomainError(
        "UNSUPPORTED_MODE",
        "Mode KRS Bebas belum tersedia."
      );
    },
    mode: "FREE",
  },
  PACKAGE: packageStudyPlanStrategy,
};

export const assertStudyPlanReadRole = (roles: readonly RoleKey[]): void => {
  if (
    !roles.some((role) =>
      ["SUPERADMIN", "ADMIN_AKADEMIK", "KAPRODI", "MAHASISWA"].includes(role)
    )
  ) {
    throw new StudyPlanDomainError(
      "READ_ONLY_ROLE",
      "Peran Anda tidak memiliki akses ke KRS."
    );
  }
};

export const assertStudyPlanManageRole = (roles: readonly RoleKey[]): void => {
  if (!roles.includes("SUPERADMIN") && !roles.includes("ADMIN_AKADEMIK")) {
    throw new StudyPlanDomainError(
      "READ_ONLY_ROLE",
      "Peran Anda hanya dapat melihat KRS."
    );
  }
};

export const normalizeStudyPlanReason = (reason: string): string => {
  const normalized = reason.trim().replaceAll(/\s+/gu, " ");
  if (normalized.length < 10 || normalized.length > 500) {
    throw new StudyPlanDomainError(
      "INVALID_REASON",
      "Alasan harus terdiri dari 10–500 karakter.",
      { reason: ["Masukkan alasan 10–500 karakter."] }
    );
  }
  return normalized;
};

export const calculateStudyPlanTotals = (
  items: readonly Pick<StudyPlanItemDraft, "credits">[]
): { totalCourses: number; totalCredits: number } => {
  const totalCredits = items.reduce((total, item) => total + item.credits, 0);
  if (!Number.isSafeInteger(totalCredits) || totalCredits < 0) {
    throw new StudyPlanDomainError(
      "INVALID_TOTAL_CREDITS",
      "Total SKS KRS tidak valid."
    );
  }
  return { totalCourses: items.length, totalCredits };
};
