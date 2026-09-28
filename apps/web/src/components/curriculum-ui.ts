import type { CurriculumStatus } from "@siakad-itbkmmubar/api/curriculum";

export type CurriculumBasePath =
  | "/admin-akademik/kurikulum"
  | "/kaprodi/kurikulum"
  | "/superadmin/kurikulum";

export const curriculumRoutePaths = {
  "/admin-akademik/kurikulum": {
    assessment: "/admin-akademik/kurikulum/$curriculumId/komponen-nilai",
    detail: "/admin-akademik/kurikulum/$curriculumId",
    structure: "/admin-akademik/kurikulum/$curriculumId/struktur",
  },
  "/kaprodi/kurikulum": {
    assessment: "/kaprodi/kurikulum/$curriculumId/komponen-nilai",
    detail: "/kaprodi/kurikulum/$curriculumId",
    structure: "/kaprodi/kurikulum/$curriculumId/struktur",
  },
  "/superadmin/kurikulum": {
    assessment: "/superadmin/kurikulum/$curriculumId/komponen-nilai",
    detail: "/superadmin/kurikulum/$curriculumId",
    structure: "/superadmin/kurikulum/$curriculumId/struktur",
  },
} as const satisfies Record<
  CurriculumBasePath,
  { assessment: string; detail: string; structure: string }
>;

export const curriculumStatusLabels: Record<CurriculumStatus, string> = {
  ACTIVE: "Aktif",
  ARCHIVED: "Diarsipkan",
  DRAFT: "Draft",
};

export const curriculumStatusClassNames: Record<CurriculumStatus, string> = {
  ACTIVE: "bg-[#e7f7ef] text-[#137a4b]",
  ARCHIVED: "bg-[#f1f4f7] text-[#5c6f82]",
  DRAFT: "bg-[#fff2df] text-[#9a5a00]",
};

export const formatCurriculumDate = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export const recordText = (
  record: Record<string, unknown>,
  key: string
): string => {
  const value = record[key];
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
};
