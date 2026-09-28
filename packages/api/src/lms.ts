import type { RoleKey } from "@api/identity";

export const learningContentStatuses = ["DRAFT", "PUBLISHED"] as const;
export type LearningContentStatus = (typeof learningContentStatuses)[number];

export const forumThreadStatuses = ["OPEN", "CLOSED"] as const;
export type ForumThreadStatus = (typeof forumThreadStatuses)[number];

export class LmsDomainError extends Error {
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
    this.name = "LmsDomainError";
  }
}

export interface LmsActor {
  actorRoles: readonly RoleKey[];
  actorUserId: string;
}

export interface LmsFileInput {
  contentBase64: string;
  declaredMime?: string;
  filename: string;
  mimeType: string;
}

export interface LmsFileRecord {
  fileObjectId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface LmsMaterialRecord {
  body: string | null;
  classMeetingId: string | null;
  classSectionId: string;
  createdAt: string;
  createdBy: string;
  files: readonly LmsFileRecord[];
  id: string;
  status: LearningContentStatus;
  title: string;
  updatedAt: string;
  version: number;
}

export interface LmsAssignmentRecord {
  allowResubmit: boolean;
  body: string | null;
  classMeetingId: string | null;
  classSectionId: string;
  createdAt: string;
  createdBy: string;
  dueAt: string;
  files: readonly LmsFileRecord[];
  id: string;
  status: LearningContentStatus;
  title: string;
  updatedAt: string;
  version: number;
}

export interface LmsSubmissionRecord {
  assignmentId: string;
  body: string | null;
  files: readonly LmsFileRecord[];
  id: string;
  isLate: boolean;
  status: "SUBMITTED" | "LATE";
  studentId: string;
  submittedAt: string;
  version: number;
}

export interface LmsForumPostRecord {
  authorId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  id: string;
}

export interface LmsForumThreadRecord {
  classMeetingId: string | null;
  classSectionId: string;
  createdAt: string;
  createdBy: string;
  id: string;
  posts: readonly LmsForumPostRecord[];
  status: ForumThreadStatus;
  title: string;
  updatedAt: string;
}

export interface LmsClassroomRecord {
  assignments: readonly LmsAssignmentRecord[];
  classSectionId: string;
  materials: readonly LmsMaterialRecord[];
  threads: readonly LmsForumThreadRecord[];
}

const normalize = (value: string, field: string, min: number, max: number) => {
  const normalized = value.trim().replaceAll(/\s+/gu, " ");
  if (normalized.length < min || normalized.length > max) {
    throw new LmsDomainError(
      "INVALID_TEXT",
      `${field} harus terdiri dari ${min}–${max} karakter.`,
      { [field]: [`Masukkan ${field} ${min}–${max} karakter.`] }
    );
  }
  return normalized;
};

export const normalizeLmsTitle = (value: string): string =>
  normalize(value, "judul", 1, 160);

export const normalizeLmsBody = (value: string | undefined): string | null => {
  if (value === undefined) {
    return null;
  }
  const normalized = value.trim();
  if (normalized.length > 20_000) {
    throw new LmsDomainError("INVALID_BODY", "Isi terlalu panjang.", {
      body: ["Isi maksimal 20.000 karakter."],
    });
  }
  return normalized || null;
};

export const assertLmsReadRole = (roles: readonly RoleKey[]): void => {
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
    throw new LmsDomainError(
      "READ_ONLY_ROLE",
      "Peran Anda tidak memiliki akses LMS."
    );
  }
};

export const assertLmsManageRole = (roles: readonly RoleKey[]): void => {
  if (
    !roles.includes("SUPERADMIN") &&
    !roles.includes("ADMIN_AKADEMIK") &&
    !roles.includes("KAPRODI") &&
    !roles.includes("DOSEN")
  ) {
    throw new LmsDomainError(
      "READ_ONLY_ROLE",
      "Peran Anda tidak dapat mengelola LMS."
    );
  }
};

export const assertPublishedForStudent = (
  status: LearningContentStatus,
  isStudent: boolean
): void => {
  if (isStudent && status !== "PUBLISHED") {
    throw new LmsDomainError(
      "CONTENT_NOT_FOUND",
      "Konten LMS tidak ditemukan."
    );
  }
};

export const determineSubmissionStatus = (
  submittedAt: Date,
  dueAt: Date
): { isLate: boolean; status: "SUBMITTED" | "LATE" } => {
  if (Number.isNaN(submittedAt.getTime()) || Number.isNaN(dueAt.getTime())) {
    throw new LmsDomainError("INVALID_DATE", "Waktu pengumpulan tidak valid.");
  }
  const isLate = submittedAt.getTime() > dueAt.getTime();
  return { isLate, status: isLate ? "LATE" : "SUBMITTED" };
};

export const encodeLmsCursor = (createdAt: Date, id: string): string =>
  btoa(JSON.stringify({ createdAt: createdAt.toISOString(), id }));

export const decodeLmsCursor = (
  cursor: string
): { createdAt: Date; id: string } => {
  try {
    const value = JSON.parse(atob(cursor)) as {
      createdAt?: string;
      id?: string;
    };
    const createdAt = new Date(value.createdAt ?? "");
    if (!value.id || Number.isNaN(createdAt.getTime())) {
      throw new Error("invalid cursor");
    }
    return { createdAt, id: value.id };
  } catch {
    throw new LmsDomainError(
      "INVALID_CURSOR",
      "Penanda halaman LMS tidak valid."
    );
  }
};
