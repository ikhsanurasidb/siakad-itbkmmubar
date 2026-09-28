import type { RoleKey } from "@api/identity";

export const curriculumStatuses = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type CurriculumStatus = (typeof curriculumStatuses)[number];

export const curriculumCourseTypes = ["REQUIRED", "ELECTIVE"] as const;
export type CurriculumCourseType = (typeof curriculumCourseTypes)[number];

export interface CurriculumAssessmentComponent {
  componentCode: string;
  label: string;
  weight: number;
}

export interface CurriculumCourseInput {
  courseId: string;
  courseType: CurriculumCourseType;
  semester: number;
}

export interface CurriculumCourseRecord extends CurriculumCourseInput {
  courseCode: string;
  courseName: string;
  credits: number;
  id: string;
  sortOrder: number;
}

export interface CurriculumDocumentRecord {
  createdAt: string;
  documentType: string;
  fileObjectId: string;
  filename: string;
  id: string;
  mimeType: string;
  sizeBytes: number;
}

export interface CurriculumAssessmentRecord {
  components: readonly CurriculumAssessmentComponent[];
  curriculumCourseId: string;
  inherited: boolean;
}

export interface CurriculumRecord {
  cohort: { entryYear: number; id: string };
  courses: readonly CurriculumCourseRecord[];
  createdAt: string;
  documents: readonly CurriculumDocumentRecord[];
  id: string;
  name: string;
  assessments: readonly CurriculumAssessmentRecord[];
  status: CurriculumStatus;
  studyProgram: { code: string; id: string; name: string };
  updatedAt: string;
}

export interface CurriculumListItem {
  cohort: { entryYear: number; id: string };
  courseCount: number;
  createdAt: string;
  id: string;
  name: string;
  status: CurriculumStatus;
  studyProgram: { code: string; id: string; name: string };
  updatedAt: string;
}

export const DEFAULT_COURSE_ASSESSMENT_COMPONENTS: readonly CurriculumAssessmentComponent[] =
  [
    { componentCode: "TUGAS", label: "Tugas", weight: 30 },
    { componentCode: "UTS", label: "Ujian tengah semester", weight: 30 },
    { componentCode: "UAS", label: "Ujian akhir semester", weight: 40 },
  ];

export class CurriculumDomainError extends Error {
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
    this.name = "CurriculumDomainError";
  }
}

export const normalizeCurriculumName = (value: string): string => {
  const normalized = value.trim().replaceAll(/\s+/gu, " ");
  if (normalized.length < 3 || normalized.length > 160) {
    throw new CurriculumDomainError(
      "INVALID_NAME",
      "Nama kurikulum harus terdiri dari 3–160 karakter.",
      { name: ["Masukkan nama kurikulum 3–160 karakter."] }
    );
  }
  return normalized;
};

export const assertCurriculumRole = (roles: readonly RoleKey[]): void => {
  if (
    !roles.includes("SUPERADMIN") &&
    !roles.includes("ADMIN_AKADEMIK") &&
    !roles.includes("KAPRODI")
  ) {
    throw new CurriculumDomainError(
      "READ_ONLY_ROLE",
      "Peran Anda tidak memiliki akses ke kurikulum."
    );
  }
};

export const assertCurriculumManageRole = (roles: readonly RoleKey[]): void => {
  if (!roles.includes("SUPERADMIN") && !roles.includes("KAPRODI")) {
    throw new CurriculumDomainError(
      "READ_ONLY_ROLE",
      "Peran Anda hanya dapat melihat kurikulum."
    );
  }
};

const normalizeComponentCode = (value: string): string => {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9_]{1,32}$/u.test(normalized)) {
    throw new CurriculumDomainError(
      "INVALID_COMPONENT_CODE",
      "Kode komponen nilai hanya boleh berisi huruf, angka, dan garis bawah."
    );
  }
  return normalized;
};

export const validateAssessmentComponents = (
  components: readonly CurriculumAssessmentComponent[],
  requireComplete = false
): CurriculumAssessmentComponent[] => {
  if (components.length === 0) {
    throw new CurriculumDomainError(
      "ASSESSMENT_COMPONENTS_REQUIRED",
      "Minimal satu komponen nilai harus diatur."
    );
  }

  const normalized = components.map((component) => {
    const label = component.label.trim();
    if (label.length < 1 || label.length > 80) {
      throw new CurriculumDomainError(
        "INVALID_COMPONENT_LABEL",
        "Label komponen nilai harus diisi dan maksimal 80 karakter."
      );
    }
    if (!Number.isSafeInteger(component.weight) || component.weight < 0) {
      throw new CurriculumDomainError(
        "INVALID_COMPONENT_WEIGHT",
        "Bobot komponen nilai harus berupa bilangan bulat positif atau nol."
      );
    }
    return {
      componentCode: normalizeComponentCode(component.componentCode),
      label,
      weight: component.weight,
    };
  });

  const codes = new Set<string>();
  for (const component of normalized) {
    if (codes.has(component.componentCode)) {
      throw new CurriculumDomainError(
        "DUPLICATE_COMPONENT",
        `Komponen nilai ${component.componentCode} tidak boleh berulang.`
      );
    }
    codes.add(component.componentCode);
  }

  const totalWeight = normalized.reduce(
    (total, component) => total + component.weight,
    0
  );
  if (totalWeight > 100) {
    throw new CurriculumDomainError(
      "ASSESSMENT_WEIGHT_OVERFLOW",
      "Total bobot komponen nilai tidak boleh melebihi 100%."
    );
  }
  if (requireComplete && totalWeight !== 100) {
    throw new CurriculumDomainError(
      "ASSESSMENT_WEIGHT_INCOMPLETE",
      "Total bobot komponen nilai harus tepat 100% sebelum kurikulum diaktifkan."
    );
  }

  return normalized;
};

export const validateCurriculumStructure = (
  courses: readonly CurriculumCourseInput[]
): CurriculumCourseInput[] => {
  const seenCourseIds = new Set<string>();
  const seenSemesterCourses = new Set<string>();
  return courses.map((course) => {
    if (!course.courseId.trim()) {
      throw new CurriculumDomainError(
        "COURSE_REQUIRED",
        "Mata kuliah wajib dipilih."
      );
    }
    if (
      !Number.isSafeInteger(course.semester) ||
      course.semester < 1 ||
      course.semester > 8
    ) {
      throw new CurriculumDomainError(
        "INVALID_SEMESTER",
        "Semester kurikulum harus berada pada rentang 1–8."
      );
    }
    if (!curriculumCourseTypes.includes(course.courseType)) {
      throw new CurriculumDomainError(
        "INVALID_COURSE_TYPE",
        "Jenis mata kuliah tidak valid."
      );
    }
    if (seenCourseIds.has(course.courseId)) {
      throw new CurriculumDomainError(
        "DUPLICATE_COURSE",
        "Mata kuliah tidak boleh muncul lebih dari satu kali dalam kurikulum."
      );
    }
    const semesterCourseKey = `${course.semester}:${course.courseId}`;
    if (seenSemesterCourses.has(semesterCourseKey)) {
      throw new CurriculumDomainError(
        "DUPLICATE_SEMESTER_COURSE",
        "Mata kuliah duplikat pada semester yang sama tidak diperbolehkan."
      );
    }
    seenCourseIds.add(course.courseId);
    seenSemesterCourses.add(semesterCourseKey);
    return { ...course, courseId: course.courseId.trim() };
  });
};

export const assessmentComponentsAreComplete = (
  components: readonly CurriculumAssessmentComponent[]
): boolean =>
  components.length > 0 &&
  components.reduce((total, component) => total + component.weight, 0) === 100;
