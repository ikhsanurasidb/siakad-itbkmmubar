import {
  academicPeriodTerms,
  importEntityTypes,
  importRowStatuses,
  masterDataStatuses,
  studyProgramDegrees,
} from "@siakad-itbkmmubar/db/schema/master-data";

export const MASTER_DATA_TEMPLATE_VERSION = "1";

export const masterDataEntityTypes = importEntityTypes;
export const masterDataStatusesList = masterDataStatuses;
export const masterDataImportRowStatuses = importRowStatuses;
export const academicTerms = academicPeriodTerms;
export const studyProgramDegreeOptions = studyProgramDegrees;

export type MasterDataEntityType = (typeof masterDataEntityTypes)[number];
export type MasterDataStatus = (typeof masterDataStatusesList)[number];
export type ImportRowStatus = (typeof masterDataImportRowStatuses)[number];
export type StudyProgramDegree = (typeof studyProgramDegreeOptions)[number];

export class MasterDataDomainError extends Error {
  readonly code: string;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    code: string,
    message: string,
    fieldErrors?: Record<string, string[]>
  ) {
    super(message);
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.name = "MasterDataDomainError";
  }
}

export const normalizeText = (value: string): string =>
  value.trim().replaceAll(/\s+/gu, " ");

export const normalizeCode = (value: string, fieldName = "Kode"): string => {
  const normalized = normalizeText(value).toUpperCase();
  if (!normalized || !/^[A-Z0-9][A-Z0-9._/-]*$/u.test(normalized)) {
    throw new MasterDataDomainError(
      "INVALID_CODE",
      `${fieldName} hanya boleh berisi huruf, angka, titik, garis miring, garis bawah, atau tanda hubung.`
    );
  }
  return normalized;
};

export const normalizeStudyProgramDegree = (
  value: string
): StudyProgramDegree => {
  const normalized = normalizeText(value).toUpperCase();
  if (!studyProgramDegreeOptions.includes(normalized as StudyProgramDegree)) {
    throw new MasterDataDomainError(
      "INVALID_DEGREE",
      "Jenjang hanya boleh S1, S2, atau S3.",
      { degree: ["Pilih jenjang S1, S2, atau S3."] }
    );
  }
  return normalized as StudyProgramDegree;
};

export const normalizeIdentifierValue = (
  value: string,
  fieldName: string
): string => {
  const normalized = normalizeText(value).toUpperCase();
  if (!normalized || !/^[A-Z0-9]+$/u.test(normalized)) {
    throw new MasterDataDomainError(
      "INVALID_IDENTIFIER",
      `${fieldName} hanya boleh berisi huruf dan angka.`
    );
  }
  return normalized;
};

export const parseInteger = (value: string, fieldName: string): number => {
  const normalized = normalizeText(value);
  if (!/^\d+$/u.test(normalized)) {
    throw new MasterDataDomainError(
      "INVALID_NUMBER",
      `${fieldName} harus berupa bilangan bulat.`
    );
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) {
    throw new MasterDataDomainError(
      "INVALID_NUMBER",
      `${fieldName} berada di luar rentang yang didukung.`
    );
  }
  return parsed;
};

export const parseCoordinate = (
  value: string,
  fieldName: "latitude" | "longitude"
): number => {
  const parsed = Number(normalizeText(value));
  const min = fieldName === "latitude" ? -90 : -180;
  const max = fieldName === "latitude" ? 90 : 180;
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new MasterDataDomainError(
      "INVALID_COORDINATE",
      `${fieldName} harus berada pada rentang ${min} sampai ${max}.`
    );
  }
  return parsed;
};

export const parseDate = (value: string, fieldName: string): Date => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new MasterDataDomainError(
      "INVALID_DATE",
      `${fieldName} harus berupa tanggal yang valid.`
    );
  }
  return date;
};

export const normalizeOptional = (value: string | undefined): string | null => {
  const normalized = value === undefined ? "" : normalizeText(value);
  return normalized || null;
};

export const assertTemplateVersion = (version: string): void => {
  if (version !== MASTER_DATA_TEMPLATE_VERSION) {
    throw new MasterDataDomainError(
      "TEMPLATE_VERSION_MISMATCH",
      `Versi template tidak didukung. Gunakan template versi ${MASTER_DATA_TEMPLATE_VERSION}.`
    );
  }
};

export const requiredHeadersByEntity: Record<
  MasterDataEntityType,
  readonly string[]
> = {
  ACADEMIC_PERIOD: ["academic_year_code", "term", "start_date", "end_date"],
  ACADEMIC_YEAR: ["code", "start_year", "end_year"],
  COHORT: ["study_program_code", "entry_year"],
  COURSE: ["code", "name", "credits", "default_semester", "study_program_code"],
  LECTURER: ["name"],
  ROOM: ["code", "name", "capacity", "latitude", "longitude"],
  STUDENT: ["nim", "name", "study_program_code", "cohort_entry_year"],
  STUDY_PROGRAM: ["code", "name", "degree"],
};

export const templateHeaders = (
  entityType: MasterDataEntityType
): readonly string[] => [
  ...requiredHeadersByEntity[entityType],
  ...(entityType === "STUDENT" ? ["email", "phone"] : []),
  ...(entityType === "LECTURER" ? ["nidn", "nuptk", "email", "phone"] : []),
];

export const assertHeaders = (
  entityType: MasterDataEntityType,
  headers: readonly string[]
): void => {
  const normalizedHeaders = new Set(
    headers.map((header) => normalizeText(header).toLowerCase())
  );
  if (normalizedHeaders.has("dsn")) {
    throw new MasterDataDomainError(
      "DSN_NOT_IMPORTABLE",
      "Kolom DSN tidak boleh diisi dari file. Identifier DSN diterbitkan server."
    );
  }
  const required = requiredHeadersByEntity[entityType];
  const missing = required.filter((header) => !normalizedHeaders.has(header));
  if (missing.length > 0) {
    throw new MasterDataDomainError(
      "INVALID_TEMPLATE_HEADERS",
      "Header template tidak lengkap.",
      { headers: missing.map((header) => `Kolom ${header} wajib tersedia.`) }
    );
  }
};

export const parseCsvLine = (line: string): string[] => {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (const character of line) {
    if (character === '"') {
      quoted = !quoted;
      continue;
    }
    if (character === "," && !quoted) {
      values.push(value.trim());
      value = "";
      continue;
    }
    value += character;
  }
  if (quoted) {
    throw new MasterDataDomainError(
      "INVALID_CSV",
      "CSV memiliki tanda kutip yang tidak berpasangan."
    );
  }
  values.push(value.trim());
  return values;
};

export const parseCsv = function* parseCsv(
  content: string
): Generator<string[]> {
  const lines = content.replace(/^\uFEFF/u, "").split(/\r?\n/u);
  for (const line of lines) {
    if (line.trim()) {
      yield parseCsvLine(line);
    }
  }
};

export const parseCsvRow = (
  headers: readonly string[],
  values: readonly string[]
): Record<string, string> => {
  if (headers.length !== values.length) {
    throw new MasterDataDomainError(
      "INVALID_CSV_ROW",
      "Jumlah kolom pada baris tidak sesuai dengan header."
    );
  }
  return Object.fromEntries(
    headers.map((header, index) => [header, values[index] ?? ""])
  );
};

export const assertAcademicTerm = (
  value: string
): (typeof academicTerms)[number] => {
  const normalized = normalizeText(value).toUpperCase();
  if (
    !academicPeriodTerms.includes(normalized as (typeof academicTerms)[number])
  ) {
    throw new MasterDataDomainError(
      "INVALID_TERM",
      "Term harus ODD, EVEN, atau SHORT."
    );
  }
  return normalized as (typeof academicTerms)[number];
};
