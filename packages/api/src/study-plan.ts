import type { RoleKey } from "@api/identity";

export const studyPlanModes = ["PACKAGE", "FREE"] as const;
export type StudyPlanMode = (typeof studyPlanModes)[number];

export const studyPlanStatuses = ["DRAFT", "FINAL"] as const;
export type StudyPlanStatus = (typeof studyPlanStatuses)[number];

export type StudyPlanHistoryAction = "GENERATE" | "FINALIZE" | "REOPEN";

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

export interface StudyPlanFailure {
  message: string;
  nim: string;
  reasonCode: "CURRICULUM_NOT_FOUND" | "GENERATION_FAILED";
  studentId: string;
}

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
