import {
  academicPeriodTermLabels,
  academicTerms,
  studyProgramDegreeOptions,
} from "@siakad-itbkmmubar/api/master-data";

import type { FieldDefinition } from "@/components/master-data-create-form";
import type { MasterDataEntityType } from "@/components/master-data-types";

const masterDataReferenceFieldIds = new Set([
  "academicYearId",
  "cohortId",
  "studyProgramId",
]);

export const isMasterDataReferenceField = (fieldId: string): boolean =>
  masterDataReferenceFieldIds.has(fieldId);

export const getMasterDataReferenceLabel = (
  record: Record<string, unknown>,
  fieldId: string
): string | undefined => {
  if (fieldId === "academicYearId") {
    const code = record.academicYearCode;
    return typeof code === "string" && code ? code : undefined;
  }
  if (fieldId === "cohortId") {
    const entryYear = record.cohortEntryYear;
    return typeof entryYear === "string" || typeof entryYear === "number"
      ? `Angkatan ${entryYear}`
      : undefined;
  }
  if (fieldId === "studyProgramId") {
    const name = record.studyProgramName;
    return typeof name === "string" && name ? name : undefined;
  }
  return undefined;
};

export const masterDataFieldDefinitions: Record<
  MasterDataEntityType,
  readonly FieldDefinition[]
> = {
  ACADEMIC_PERIOD: [
    { id: "academicYearId", label: "Tahun akademik" },
    {
      id: "term",
      label: "Semester",
      optionLabels: academicPeriodTermLabels,
      options: academicTerms,
      type: "select",
    },
    { id: "startDate", label: "Tanggal mulai", type: "date" },
    { id: "endDate", label: "Tanggal akhir", type: "date" },
  ],
  ACADEMIC_YEAR: [
    { id: "code", label: "Kode" },
    { id: "startYear", label: "Tahun mulai", type: "number" },
    { id: "endYear", label: "Tahun akhir", type: "number" },
  ],
  COHORT: [
    { id: "studyProgramId", label: "Prodi" },
    { id: "entryYear", label: "Tahun masuk", type: "number" },
  ],
  COURSE: [
    { id: "code", label: "Kode" },
    { id: "name", label: "Nama" },
    { id: "credits", label: "SKS", type: "number" },
    {
      id: "defaultSemester",
      label: "Semester",
      optional: true,
      type: "number",
    },
    { id: "studyProgramId", label: "Prodi" },
  ],
  LECTURER: [
    { id: "name", label: "Nama" },
    { id: "nidn", label: "NIDN", optional: true },
    { id: "nuptk", label: "NUPTK", optional: true },
    { id: "email", label: "Email", optional: true, type: "text" },
    { id: "phone", label: "Telepon", optional: true },
  ],
  ROOM: [
    { id: "code", label: "Kode" },
    { id: "name", label: "Nama" },
    { id: "capacity", label: "Kapasitas", type: "number" },
    { id: "latitude", label: "Latitude", type: "number" },
    { id: "longitude", label: "Longitude", type: "number" },
  ],
  STUDENT: [
    { id: "nim", label: "NIM" },
    { id: "name", label: "Nama" },
    { id: "studyProgramId", label: "Prodi" },
    { id: "cohortId", label: "Angkatan" },
    { id: "email", label: "Email", optional: true },
    { id: "phone", label: "Telepon", optional: true },
  ],
  STUDY_PROGRAM: [
    { id: "code", label: "Kode" },
    { id: "name", label: "Nama" },
    {
      id: "degree",
      label: "Jenjang",
      options: studyProgramDegreeOptions,
      type: "select",
    },
  ],
};

export const masterDataEntityLabels: Record<MasterDataEntityType, string> = {
  ACADEMIC_PERIOD: "Periode",
  ACADEMIC_YEAR: "Tahun akademik",
  COHORT: "Angkatan",
  COURSE: "Mata kuliah",
  LECTURER: "Dosen",
  ROOM: "Ruang",
  STUDENT: "Mahasiswa",
  STUDY_PROGRAM: "Prodi",
};
