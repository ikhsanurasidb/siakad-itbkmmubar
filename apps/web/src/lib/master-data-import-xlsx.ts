import {
  MASTER_DATA_TEMPLATE_VERSION,
  assertHeaders,
  normalizeText,
  requiredHeadersByEntity,
  templateHeaders,
} from "@siakad-itbkmmubar/api/master-data";
import type {
  MasterDataEntityType,
  MasterDataImportRow,
} from "@siakad-itbkmmubar/api/master-data";

import { masterDataEntitySlugs } from "@/components/master-data-types";

export const MASTER_DATA_IMPORT_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const MASTER_DATA_IMPORT_MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MASTER_DATA_IMPORT_MAX_ROWS = 10_000;

interface ParsedMasterDataWorkbook {
  rows: MasterDataImportRow[];
  rowCount: number;
}

interface TemplateFieldGuidance {
  example: string;
  label: string;
  rule: string;
}

const templateFieldGuidance: Record<
  MasterDataEntityType,
  Readonly<Record<string, TemplateFieldGuidance>>
> = {
  ACADEMIC_PERIOD: {
    academic_year_code: {
      example: "2026/2027",
      label: "Kode tahun akademik",
      rule: "Harus sama dengan kode tahun akademik yang aktif.",
    },
    end_date: {
      example: "2027-01-31",
      label: "Tanggal akhir",
      rule: "Tanggal valid format YYYY-MM-DD dan tidak boleh sebelum tanggal mulai.",
    },
    start_date: {
      example: "2026-09-01",
      label: "Tanggal mulai",
      rule: "Tanggal valid format YYYY-MM-DD.",
    },
    term: {
      example: "ODD",
      label: "Term",
      rule: "Hanya boleh ODD, EVEN, atau SHORT.",
    },
  },
  ACADEMIC_YEAR: {
    code: {
      example: "2026/2027",
      label: "Kode",
      rule: "Wajib diisi dan harus unik.",
    },
    end_year: {
      example: "2027",
      label: "Tahun akhir",
      rule: "Bilangan bulat dan harus satu tahun setelah start_year.",
    },
    start_year: {
      example: "2026",
      label: "Tahun mulai",
      rule: "Bilangan bulat tahun akademik.",
    },
  },
  COHORT: {
    entry_year: {
      example: "2026",
      label: "Tahun masuk",
      rule: "Bilangan bulat dan harus sesuai dengan angkatan yang akan dibuat.",
    },
    study_program_code: {
      example: "TI",
      label: "Kode Prodi",
      rule: "Harus sama dengan kode Prodi yang aktif.",
    },
  },
  COURSE: {
    code: {
      example: "IF101",
      label: "Kode",
      rule: "Huruf, angka, titik, garis miring, garis bawah, atau tanda hubung. Harus unik.",
    },
    credits: {
      example: "3",
      label: "SKS",
      rule: "Bilangan bulat 1 sampai 6.",
    },
    default_semester: {
      example: "1",
      label: "Semester default",
      rule: "Bilangan bulat 1 sampai 14.",
    },
    name: {
      example: "Algoritma dan Pemrograman",
      label: "Nama",
      rule: "Nama mata kuliah wajib diisi.",
    },
    study_program_code: {
      example: "TI",
      label: "Kode Prodi",
      rule: "Harus sama dengan kode Prodi yang aktif.",
    },
  },
  LECTURER: {
    email: {
      example: "dosen@example.com",
      label: "Email",
      rule: "Opsional. Isi alamat email jika tersedia.",
    },
    name: {
      example: "Budi Santoso",
      label: "Nama",
      rule: "Nama dosen wajib diisi.",
    },
    nidn: {
      example: "0123456789",
      label: "NIDN",
      rule: "Opsional. Hanya huruf dan angka.",
    },
    nuptk: {
      example: "1234567890123456",
      label: "NUPTK",
      rule: "Opsional. Hanya huruf dan angka.",
    },
    phone: {
      example: "081234567890",
      label: "Telepon",
      rule: "Opsional. Format sebagai teks agar angka 0 di depan tidak hilang.",
    },
  },
  ROOM: {
    capacity: {
      example: "40",
      label: "Kapasitas",
      rule: "Bilangan bulat positif.",
    },
    code: {
      example: "R-101",
      label: "Kode",
      rule: "Huruf, angka, titik, garis miring, garis bawah, atau tanda hubung. Harus unik.",
    },
    latitude: {
      example: "-6.200000",
      label: "Latitude",
      rule: "Angka antara -90 dan 90.",
    },
    longitude: {
      example: "106.816666",
      label: "Longitude",
      rule: "Angka antara -180 dan 180.",
    },
    name: {
      example: "Ruang 101",
      label: "Nama",
      rule: "Nama ruang wajib diisi.",
    },
  },
  STUDENT: {
    cohort_entry_year: {
      example: "2026",
      label: "Tahun angkatan",
      rule: "Bilangan bulat dan harus sesuai dengan angkatan aktif pada Prodi.",
    },
    email: {
      example: "mahasiswa@example.com",
      label: "Email",
      rule: "Opsional. Isi alamat email jika tersedia.",
    },
    name: {
      example: "Siti Aminah",
      label: "Nama",
      rule: "Nama mahasiswa wajib diisi.",
    },
    nim: {
      example: "20260001",
      label: "NIM",
      rule: "Hanya huruf dan angka. Format sebagai teks agar angka 0 di depan tidak hilang.",
    },
    phone: {
      example: "081234567890",
      label: "Telepon",
      rule: "Opsional. Format sebagai teks agar angka 0 di depan tidak hilang.",
    },
    study_program_code: {
      example: "TI",
      label: "Kode Prodi",
      rule: "Harus sama dengan kode Prodi yang aktif.",
    },
  },
  STUDY_PROGRAM: {
    code: {
      example: "TI",
      label: "Kode",
      rule: "Huruf, angka, titik, garis miring, garis bawah, atau tanda hubung. Harus unik.",
    },
    degree: {
      example: "S1",
      label: "Jenjang",
      rule: "Hanya boleh S1, S2, atau S3.",
    },
    name: {
      example: "Teknik Informatika",
      label: "Nama",
      rule: "Nama Prodi wajib diisi.",
    },
  },
};

const asCellText = (value: unknown): string => {
  if (value === undefined || value === null) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
};

const normalizeHeader = (value: unknown): string =>
  normalizeText(asCellText(value).replace(/^\uFEFF/u, "")).toLowerCase();

const isBlankRow = (row: readonly unknown[]): boolean =>
  row.every((value) => !normalizeText(asCellText(value)));

const validateFile = (file: File): void => {
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw new Error("File impor harus berformat .xlsx.");
  }
  if (file.size > MASTER_DATA_IMPORT_MAX_FILE_SIZE) {
    throw new Error("Ukuran file impor maksimal 10 MB.");
  }
};

export const parseMasterDataWorkbook = async (
  file: File,
  entityType: MasterDataEntityType
): Promise<ParsedMasterDataWorkbook> => {
  validateFile(file);
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), {
    cellDates: true,
    type: "array",
  });
  const dataSheetName = workbook.SheetNames.includes("Data")
    ? "Data"
    : workbook.SheetNames[0];
  if (!dataSheetName) {
    throw new Error("Workbook tidak memiliki worksheet.");
  }
  const worksheet = workbook.Sheets[dataSheetName];
  if (!worksheet) {
    throw new Error("Worksheet pertama tidak dapat dibaca.");
  }
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    blankrows: false,
    defval: "",
    header: 1,
    raw: false,
  });
  const [headerRow, ...dataRows] = matrix;
  if (!headerRow || isBlankRow(headerRow)) {
    throw new Error("Worksheet tidak memiliki baris header.");
  }

  const headers = headerRow.map(normalizeHeader);
  const duplicateHeaders = headers.filter(
    (header, index) => header && headers.indexOf(header) !== index
  );
  if (duplicateHeaders.length > 0) {
    throw new Error(
      `Header duplikat: ${[...new Set(duplicateHeaders)].join(", ")}.`
    );
  }
  assertHeaders(entityType, headers);

  const expectedHeaders = templateHeaders(entityType);
  const headerIndexes = new Map(
    headers.map((header, index) => [header, index] as const)
  );
  const rows = dataRows
    .filter((row) => !isBlankRow(row))
    .map((row) =>
      Object.fromEntries(
        expectedHeaders.map((header) => [
          header,
          asCellText(row[headerIndexes.get(header) ?? -1]),
        ])
      )
    )
    .filter((row) => Object.values(row).some(Boolean));

  if (rows.length === 0) {
    throw new Error("Worksheet tidak memiliki data untuk diproses.");
  }
  if (rows.length > MASTER_DATA_IMPORT_MAX_ROWS) {
    throw new Error(
      `Jumlah baris impor maksimal ${MASTER_DATA_IMPORT_MAX_ROWS.toLocaleString("id-ID")}.`
    );
  }

  return {
    rowCount: rows.length,
    rows: rows as MasterDataImportRow[],
  };
};

export const calculateMasterDataImportChecksum = async (
  entityType: MasterDataEntityType,
  rows: readonly MasterDataImportRow[]
): Promise<string> => {
  const content = JSON.stringify({
    entityType,
    rows,
    templateVersion: MASTER_DATA_TEMPLATE_VERSION,
  });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(content)
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
};

export const downloadMasterDataTemplate = async (
  entityType: MasterDataEntityType
): Promise<void> => {
  const XLSX = await import("xlsx");
  const headers = templateHeaders(entityType);
  const dataWorksheet = XLSX.utils.aoa_to_sheet([[...headers]]);
  dataWorksheet["!cols"] = headers.map((header) => ({
    wch: Math.max(header.length + 2, 18),
  }));
  const requiredHeaders = new Set(requiredHeadersByEntity[entityType]);
  const guidanceWorksheet = XLSX.utils.aoa_to_sheet([
    ["Field", "Keterangan", "Wajib", "Contoh", "Aturan input"],
    ...headers.map((header) => {
      const guidance = templateFieldGuidance[entityType][header];
      return [
        header,
        guidance.label,
        requiredHeaders.has(header) ? "Ya" : "Tidak",
        guidance.example,
        guidance.rule,
      ];
    }),
  ]);
  guidanceWorksheet["!cols"] = [
    { wch: 24 },
    { wch: 26 },
    { wch: 10 },
    { wch: 28 },
    { wch: 80 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, dataWorksheet, "Data");
  XLSX.utils.book_append_sheet(workbook, guidanceWorksheet, "Petunjuk");
  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const objectUrl = URL.createObjectURL(
    new Blob([output], { type: MASTER_DATA_IMPORT_MIME_TYPE })
  );
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `template-${masterDataEntitySlugs[entityType]}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
};
