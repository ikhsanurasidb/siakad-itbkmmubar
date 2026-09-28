export type MasterDataEntityType =
  | "ACADEMIC_PERIOD"
  | "ACADEMIC_YEAR"
  | "COHORT"
  | "COURSE"
  | "LECTURER"
  | "ROOM"
  | "STUDENT"
  | "STUDY_PROGRAM";

export const masterDataEntitySlugs: Record<MasterDataEntityType, string> = {
  ACADEMIC_PERIOD: "semester",
  ACADEMIC_YEAR: "tahun-akademik",
  COHORT: "angkatan",
  COURSE: "mata-kuliah",
  LECTURER: "dosen",
  ROOM: "ruang",
  STUDENT: "mahasiswa",
  STUDY_PROGRAM: "prodi",
};

export const masterDataEntityFromSlug = (
  slug: string
): MasterDataEntityType | null => {
  const entry = Object.entries(masterDataEntitySlugs).find(
    ([, value]) => value === slug
  );
  return (entry?.[0] as MasterDataEntityType | undefined) ?? null;
};
