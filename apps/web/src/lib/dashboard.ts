import type { RoleKey } from "@siakad-itbkmmubar/api/identity";

export const dashboardRoleSlugs = {
  ADMIN_AKADEMIK: "admin-akademik",
  ADMIN_KEUANGAN: "admin-keuangan",
  DOSEN: "dosen",
  KAPRODI: "kaprodi",
  MAHASISWA: "mahasiswa",
  SUPERADMIN: "superadmin",
} as const satisfies Record<RoleKey, string>;

export type DashboardRoleSlug = (typeof dashboardRoleSlugs)[RoleKey];

const dashboardRolesBySlug: Record<string, RoleKey> = {
  "admin-akademik": "ADMIN_AKADEMIK",
  "admin-keuangan": "ADMIN_KEUANGAN",
  dosen: "DOSEN",
  kaprodi: "KAPRODI",
  mahasiswa: "MAHASISWA",
  superadmin: "SUPERADMIN",
};

export const getDashboardRoleSlug = (role: RoleKey): DashboardRoleSlug =>
  dashboardRoleSlugs[role];

export const getRoleFromDashboardSlug = (slug: string): RoleKey | null =>
  dashboardRolesBySlug[slug] ?? null;
