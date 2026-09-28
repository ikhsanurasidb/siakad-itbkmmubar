import { z } from "zod";

export const settingCategories = [
  "SECURITY",
  "SCHEDULING",
  "ATTENDANCE",
  "GRADING",
  "FILE",
  "BATCH",
] as const;

export type SettingCategory = (typeof settingCategories)[number];

export const settingScopeTypes = [
  "SYSTEM",
  "STUDY_PROGRAM",
  "ACADEMIC_PERIOD",
] as const;

export type SettingScopeType = (typeof settingScopeTypes)[number];

export const settingValueTypes = [
  "INTEGER",
  "DECIMAL",
  "BOOLEAN",
  "STRING",
  "ENUM",
  "JSON",
] as const;

export type SettingValueType = (typeof settingValueTypes)[number];

export const settingKeys = [
  "session_idle_timeout_hours",
  "session_refresh_interval_minutes",
  "password_min_length",
  "temporary_password_ttl_hours",
  "login_rate_limit_attempts",
  "login_lock_window_minutes",
  "schedule_change_lead_days",
  "online_meeting_max_per_class",
  "attendance_radius_meters",
  "attendance_open_offset_minutes",
  "attendance_close_offset_minutes",
  "retake_policy",
  "rounding_method",
  "rounding_precision",
  "upload_max_size_bytes",
  "allowed_mime_types",
  "import_max_rows",
  "import_chunk_size",
] as const;

export type SettingKey = (typeof settingKeys)[number];

export const settingCategoryLabels: Record<SettingCategory, string> = {
  ATTENDANCE: "Presensi",
  BATCH: "Impor dan proses",
  FILE: "Berkas",
  GRADING: "Nilai",
  SCHEDULING: "Penjadwalan",
  SECURITY: "Keamanan",
};

const boundedInteger = (minimum: number, maximum: number) =>
  z.number().int().min(minimum).max(maximum);

const settingValueSchemas = {
  allowed_mime_types: z.array(z.string().trim().min(1)).min(1).max(50),
  attendance_close_offset_minutes: boundedInteger(0, 1440),
  attendance_open_offset_minutes: boundedInteger(0, 1440),
  attendance_radius_meters: z.number().finite().positive().max(100_000),
  import_chunk_size: boundedInteger(1, 1000),
  import_max_rows: boundedInteger(1, 1_000_000),
  login_lock_window_minutes: boundedInteger(1, 1440),
  login_rate_limit_attempts: boundedInteger(1, 100),
  online_meeting_max_per_class: boundedInteger(0, 100),
  password_min_length: boundedInteger(16, 256),
  retake_policy: z.enum(["HIGHEST", "LATEST"]),
  rounding_method: z.enum(["HALF_UP", "HALF_EVEN", "TRUNCATE"]),
  rounding_precision: boundedInteger(0, 6),
  schedule_change_lead_days: boundedInteger(1, 365),
  session_idle_timeout_hours: boundedInteger(1, 720),
  session_refresh_interval_minutes: boundedInteger(5, 1440),
  temporary_password_ttl_hours: boundedInteger(1, 720),
  upload_max_size_bytes: boundedInteger(1, 1_073_741_824),
} as const satisfies Record<SettingKey, z.ZodType>;

export const settingDefinitions = [
  {
    category: "SECURITY",
    defaultValue: 72,
    description:
      "Batas waktu sesi tidak aktif sebelum pengguna harus masuk kembali.",
    key: "session_idle_timeout_hours",
    label: "Batas waktu sesi tidak aktif (jam)",
    maxValue: 720,
    minValue: 1,
    valueType: "INTEGER",
  },
  {
    category: "SECURITY",
    defaultValue: 60,
    description: "Jeda minimum pembaruan aktivitas sesi.",
    key: "session_refresh_interval_minutes",
    label: "Jeda pembaruan sesi (menit)",
    maxValue: 1440,
    minValue: 5,
    valueType: "INTEGER",
  },
  {
    category: "SECURITY",
    defaultValue: 16,
    description: "Panjang minimum semua kata sandi.",
    key: "password_min_length",
    label: "Panjang minimum kata sandi",
    maxValue: 256,
    minValue: 16,
    valueType: "INTEGER",
  },
  {
    category: "SECURITY",
    defaultValue: 24,
    description: "Masa berlaku kata sandi sementara.",
    key: "temporary_password_ttl_hours",
    label: "Masa berlaku kata sandi sementara (jam)",
    maxValue: 720,
    minValue: 1,
    valueType: "INTEGER",
  },
  {
    category: "SECURITY",
    defaultValue: 5,
    description: "Jumlah percobaan masuk sebelum akun dikunci.",
    key: "login_rate_limit_attempts",
    label: "Batas percobaan masuk",
    maxValue: 100,
    minValue: 1,
    valueType: "INTEGER",
  },
  {
    category: "SECURITY",
    defaultValue: 15,
    description: "Durasi penguncian setelah batas percobaan masuk terlampaui.",
    key: "login_lock_window_minutes",
    label: "Durasi penguncian akun (menit)",
    maxValue: 1440,
    minValue: 1,
    valueType: "INTEGER",
  },
  {
    category: "SCHEDULING",
    defaultValue: 7,
    description:
      "Batas waktu perubahan kelas dengan hitungan tanggal inklusif.",
    key: "schedule_change_lead_days",
    label: "Batas waktu perubahan kelas (hari)",
    maxValue: 365,
    minValue: 1,
    valueType: "INTEGER",
  },
  {
    category: "SCHEDULING",
    defaultValue: 2,
    description: "Maksimum pertemuan daring dalam satu kelas.",
    key: "online_meeting_max_per_class",
    label: "Maksimum pertemuan daring",
    maxValue: 100,
    minValue: 0,
    valueType: "INTEGER",
  },
  {
    category: "ATTENDANCE",
    defaultValue: 1000,
    description: "Radius presensi luring dalam meter.",
    key: "attendance_radius_meters",
    label: "Radius presensi (meter)",
    maxValue: 100_000,
    minValue: 1,
    valueType: "DECIMAL",
  },
  {
    category: "ATTENDANCE",
    defaultValue: 30,
    description: "Jeda pembukaan presensi setelah kelas dimulai.",
    key: "attendance_open_offset_minutes",
    label: "Jeda pembukaan presensi (menit)",
    maxValue: 1440,
    minValue: 0,
    valueType: "INTEGER",
  },
  {
    category: "ATTENDANCE",
    defaultValue: 60,
    description: "Jeda penutupan presensi setelah kelas selesai.",
    key: "attendance_close_offset_minutes",
    label: "Jeda penutupan presensi (menit)",
    maxValue: 1440,
    minValue: 0,
    valueType: "INTEGER",
  },
  {
    category: "GRADING",
    defaultValue: "HIGHEST",
    description: "Nilai yang digunakan untuk mata kuliah ulang.",
    key: "retake_policy",
    label: "Kebijakan mata kuliah ulang",
    maxValue: null,
    minValue: null,
    valueType: "ENUM",
  },
  {
    category: "GRADING",
    defaultValue: "HALF_UP",
    description: "Metode pembulatan nilai.",
    key: "rounding_method",
    label: "Metode pembulatan",
    maxValue: null,
    minValue: null,
    valueType: "ENUM",
  },
  {
    category: "GRADING",
    defaultValue: 2,
    description: "Presisi angka setelah pembulatan.",
    key: "rounding_precision",
    label: "Presisi pembulatan",
    maxValue: 6,
    minValue: 0,
    valueType: "INTEGER",
  },
  {
    category: "FILE",
    defaultValue: 10_485_760,
    description: "Ukuran maksimum berkas yang diunggah dalam byte.",
    key: "upload_max_size_bytes",
    label: "Ukuran maksimum unggahan (byte)",
    maxValue: 1_073_741_824,
    minValue: 1,
    valueType: "INTEGER",
  },
  {
    category: "FILE",
    defaultValue: ["application/pdf", "image/jpeg", "image/png"],
    description: "Jenis berkas yang diizinkan untuk unggahan privat.",
    key: "allowed_mime_types",
    label: "Jenis berkas yang diizinkan",
    maxValue: null,
    minValue: null,
    valueType: "JSON",
  },
  {
    category: "BATCH",
    defaultValue: 10_000,
    description: "Batas baris impor dalam satu pekerjaan.",
    key: "import_max_rows",
    label: "Maksimum baris impor",
    maxValue: 1_000_000,
    minValue: 1,
    valueType: "INTEGER",
  },
  {
    category: "BATCH",
    defaultValue: 100,
    description: "Ukuran kelompok yang aman untuk operasi massal.",
    key: "import_chunk_size",
    label: "Ukuran kelompok impor",
    maxValue: 1000,
    minValue: 1,
    valueType: "INTEGER",
  },
] as const satisfies readonly {
  category: SettingCategory;
  defaultValue: boolean | number | readonly string[] | string;
  description: string;
  key: SettingKey;
  label: string;
  maxValue: number | null;
  minValue: number | null;
  valueType: SettingValueType;
}[];

export const settingDefinitionByKey = Object.fromEntries(
  settingDefinitions.map((definition) => [definition.key, definition])
) as Record<SettingKey, (typeof settingDefinitions)[number]>;

export const settingDefaults = Object.fromEntries(
  settingDefinitions.map((definition) => [
    definition.key,
    definition.defaultValue,
  ])
) as Record<SettingKey, unknown>;

export class SettingsDomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "SettingsDomainError";
  }
}

export const parseSettingValue = (key: SettingKey, value: unknown): unknown => {
  const result = settingValueSchemas[key].safeParse(value);
  if (!result.success) {
    throw new SettingsDomainError(
      "INVALID_SETTING_VALUE",
      `Nilai pengaturan ${settingDefinitionByKey[key].label} tidak valid.`
    );
  }
  return result.data;
};

export interface SecurityPolicy {
  idleTimeoutHours: number;
  lockWindowMinutes: number;
  loginRateLimitAttempts: number;
  passwordMinimumLength: number;
  refreshIntervalMinutes: number;
  temporaryPasswordTtlHours: number;
}

export interface SchedulingPolicy {
  leadDays: number;
  onlineMeetingLimit: number;
}

export interface AttendancePolicy {
  closeOffsetMinutes: number;
  openOffsetMinutes: number;
  radiusMeters: number;
}

export interface GradingPolicy {
  retakePolicy: "HIGHEST" | "LATEST";
  roundingMethod: "HALF_UP" | "HALF_EVEN" | "TRUNCATE";
  roundingPrecision: number;
  scale: readonly GradeScaleEntry[];
  scaleVersionId: string | null;
}

export interface FilePolicy {
  allowedMimeTypes: readonly string[];
  maxSizeBytes: number;
}

export interface BatchPolicy {
  importChunkSize: number;
  importMaxRows: number;
}

export interface GradeScaleEntry {
  gradeCode: string;
  label: string;
  maxScore: number;
  minScore: number;
  qualityPoints: number;
}

export const gradeScaleEntrySchema = z.object({
  gradeCode: z.string().trim().min(1).max(10),
  label: z.string().trim().min(1).max(80),
  maxScore: z.number().finite().min(0).max(100),
  minScore: z.number().finite().min(0).max(100),
  qualityPoints: z.number().finite().min(0).max(4),
});

export const validateGradeScaleEntries = (
  entries: readonly GradeScaleEntry[]
): readonly GradeScaleEntry[] => {
  if (entries.length === 0) {
    throw new SettingsDomainError(
      "INVALID_GRADE_SCALE",
      "Grade scale minimal memiliki satu rentang nilai."
    );
  }

  const normalized = entries.map((entry) => gradeScaleEntrySchema.parse(entry));
  if (
    new Set(normalized.map((entry) => entry.gradeCode)).size !==
    normalized.length
  ) {
    throw new SettingsDomainError(
      "DUPLICATE_GRADE_CODE",
      "Setiap kode grade hanya boleh muncul satu kali."
    );
  }
  const sorted = normalized.toSorted(
    (left, right) => right.maxScore - left.maxScore
  );
  for (const [index, entry] of sorted.entries()) {
    if (entry.minScore > entry.maxScore) {
      throw new SettingsDomainError(
        "INVALID_GRADE_SCALE",
        `Rentang ${entry.gradeCode} memiliki nilai minimum lebih besar dari maksimum.`
      );
    }
    const next = sorted[index + 1];
    if (next && entry.minScore < next.maxScore) {
      throw new SettingsDomainError(
        "GRADE_SCALE_OVERLAP",
        `Rentang ${entry.gradeCode} bertumpang tindih dengan ${next.gradeCode}.`
      );
    }
    if (next && entry.minScore > next.maxScore) {
      throw new SettingsDomainError(
        "GRADE_SCALE_GAP",
        `Rentang ${entry.gradeCode} dan ${next.gradeCode} memiliki gap.`
      );
    }
  }

  const lowest = sorted.at(-1);
  const [highest] = sorted;
  if (lowest?.minScore !== 0 || highest?.maxScore !== 100) {
    throw new SettingsDomainError(
      "GRADE_SCALE_GAP",
      "Grade scale aktif harus mencakup seluruh rentang nilai 0 sampai 100."
    );
  }
  return sorted;
};
