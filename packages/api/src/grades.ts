import type { RoleKey } from "@api/identity";
import type { GradeScaleEntry, GradingPolicy } from "@api/settings";
import { z } from "zod";

export const gradeStatuses = [
  "DRAFT",
  "SUBMITTED",
  "LOCKED",
  "PUBLISHED",
] as const;
export type GradeStatus = (typeof gradeStatuses)[number];

export const gradePublicationStatuses = [
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "PARTIAL_FAILED",
  "FAILED",
] as const;
export type GradePublicationStatus = (typeof gradePublicationStatuses)[number];

export class GradeDomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "GradeDomainError";
  }
}

export interface GradeComponent {
  componentCode: string;
  label: string;
  weight: number;
}

export interface StudentScore {
  componentCode: string;
  score: number;
}

export interface CalculatedGrade {
  gradeCode: string;
  gradePoint: number;
  rawScore: number;
  roundedScore: number;
  scaleVersionId: string | null;
}

export interface PublishedGradeRow {
  academicPeriodId?: string;
  attempt: number;
  courseId: string;
  credits: number;
  gradeCode?: string;
  gradePoint: number;
  roundedScoreHundredths?: number;
  snapshotId?: string;
  studentId: string;
  takenAt: string;
}

export interface StudyResult {
  countedCredits: number;
  countedQualityPoints: number;
  ipk: number;
  ips: number;
  selected: readonly PublishedGradeRow[];
}

export const gradeComponentSchema = z.object({
  componentCode: z.string().trim().min(1).max(32),
  label: z.string().trim().min(1).max(80),
  weight: z.number().int().min(0).max(100),
});

export const scoreSchema = z.number().finite().min(0).max(100);

export const validateGradeComponents = (
  components: readonly GradeComponent[]
): readonly GradeComponent[] => {
  if (components.length === 0) {
    throw new GradeDomainError(
      "GRADE_COMPONENTS_REQUIRED",
      "Minimal satu komponen nilai harus tersedia."
    );
  }
  const normalized = components.map((component) =>
    gradeComponentSchema.parse(component)
  );
  if (
    new Set(normalized.map((component) => component.componentCode)).size !==
    normalized.length
  ) {
    throw new GradeDomainError(
      "DUPLICATE_GRADE_COMPONENT",
      "Kode komponen nilai tidak boleh berulang."
    );
  }
  const totalWeight = normalized.reduce(
    (total, component) => total + component.weight,
    0
  );
  if (totalWeight !== 100) {
    throw new GradeDomainError(
      "GRADE_WEIGHT_NOT_100",
      "Total bobot komponen nilai harus tepat 100%."
    );
  }
  return normalized;
};

const roundHalfEven = (value: number): number => {
  const floor = Math.floor(value);
  const fraction = value - floor;
  if (Math.abs(fraction - 0.5) < 1e-9) {
    return floor % 2 === 0 ? floor : floor + 1;
  }
  if (fraction < 0.5) {
    return floor;
  }
  if (fraction > 0.5) {
    return floor + 1;
  }
  return floor;
};

export const roundScore = (
  value: number,
  precision: number,
  method: GradingPolicy["roundingMethod"]
): number => {
  const factor = 10 ** precision;
  const scaled = value * factor;
  let rounded = Math.floor(scaled + 0.5);
  if (method === "TRUNCATE") {
    rounded = Math.trunc(scaled);
  } else if (method === "HALF_EVEN") {
    rounded = roundHalfEven(scaled);
  }
  return rounded / factor;
};

const findScaleEntry = (
  score: number,
  scale: readonly GradeScaleEntry[]
): GradeScaleEntry => {
  const entry = scale.find(
    (candidate) => score >= candidate.minScore && score <= candidate.maxScore
  );
  if (!entry) {
    throw new GradeDomainError(
      "GRADE_SCALE_NOT_FOUND",
      "Nilai akhir tidak memiliki rentang pada skala nilai aktif."
    );
  }
  return entry;
};

export const calculateFinalGrade = (input: {
  components: readonly GradeComponent[];
  policy: GradingPolicy;
  scores: readonly StudentScore[];
}): CalculatedGrade => {
  const components = validateGradeComponents(input.components);
  const scoreByCode = new Map(
    input.scores.map((score) => [score.componentCode, score.score])
  );
  for (const component of components) {
    const score = scoreByCode.get(component.componentCode);
    if (score === undefined) {
      throw new GradeDomainError(
        "REQUIRED_SCORE_MISSING",
        `Nilai ${component.label} belum diisi.`
      );
    }
    scoreSchema.parse(score);
  }
  const rawScore =
    components.reduce(
      (total, component) =>
        total +
        (scoreByCode.get(component.componentCode) ?? 0) * component.weight,
      0
    ) / 100;
  const roundedScore = roundScore(
    rawScore,
    input.policy.roundingPrecision,
    input.policy.roundingMethod
  );
  const scaleEntry = findScaleEntry(roundedScore, input.policy.scale);
  return {
    gradeCode: scaleEntry.gradeCode,
    gradePoint: scaleEntry.qualityPoints,
    rawScore,
    roundedScore,
    scaleVersionId: input.policy.scaleVersionId,
  };
};

export const assertGradeTransition = (
  from: GradeStatus,
  to: GradeStatus
): void => {
  const allowed: Readonly<Record<GradeStatus, readonly GradeStatus[]>> = {
    DRAFT: ["SUBMITTED"],
    LOCKED: ["PUBLISHED"],
    PUBLISHED: [],
    SUBMITTED: ["LOCKED"],
  };
  if (!allowed[from].includes(to)) {
    throw new GradeDomainError(
      "INVALID_GRADE_TRANSITION",
      `Perubahan status nilai dari ${from} ke ${to} tidak diizinkan.`
    );
  }
};

export const assertGradeRole = (
  roles: readonly RoleKey[],
  allowed: readonly RoleKey[]
): void => {
  if (!roles.some((role) => allowed.includes(role))) {
    throw new GradeDomainError(
      "GRADE_ACCESS_DENIED",
      "Anda tidak memiliki akses untuk mengubah nilai ini."
    );
  }
};

const compareAttempts = (
  left: PublishedGradeRow,
  right: PublishedGradeRow,
  policy: GradingPolicy["retakePolicy"]
): PublishedGradeRow => {
  if (policy === "LATEST") {
    return new Date(left.takenAt).getTime() >= new Date(right.takenAt).getTime()
      ? left
      : right;
  }
  if (left.gradePoint !== right.gradePoint) {
    return left.gradePoint > right.gradePoint ? left : right;
  }
  return left.gradePoint >= right.gradePoint ? left : right;
};

export const calculateStudyResult = (input: {
  allPublished: readonly PublishedGradeRow[];
  currentPeriodId?: string;
  retakePolicy: GradingPolicy["retakePolicy"];
}): StudyResult => {
  const byCourse = new Map<string, PublishedGradeRow>();
  for (const row of input.allPublished) {
    const current = byCourse.get(row.courseId);
    byCourse.set(
      row.courseId,
      current ? compareAttempts(current, row, input.retakePolicy) : row
    );
  }
  const selected = [...byCourse.values()].toSorted((left, right) =>
    left.courseId.localeCompare(right.courseId)
  );
  const countedCredits = selected.reduce(
    (total, row) => total + row.credits,
    0
  );
  const countedQualityPoints = selected.reduce(
    (total, row) => total + row.gradePoint * row.credits,
    0
  );
  const ipsRows = input.currentPeriodId
    ? selected.filter((row) => row.academicPeriodId === input.currentPeriodId)
    : selected;
  const ipsCredits = ipsRows.reduce((total, row) => total + row.credits, 0);
  const ipsQualityPoints = ipsRows.reduce(
    (total, row) => total + row.gradePoint * row.credits,
    0
  );
  return {
    countedCredits,
    countedQualityPoints,
    ipk: countedCredits ? countedQualityPoints / countedCredits : 0,
    ips: ipsCredits ? ipsQualityPoints / ipsCredits : 0,
    selected,
  };
};
