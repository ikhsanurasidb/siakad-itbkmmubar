import type { RoleKey } from "@siakad-itbkmmubar/api/identity";

export const ACTIVE_ROLE_STORAGE_KEY = "siakad-active-role";

export const roleLabels: Record<RoleKey, string> = {
  ADMIN_AKADEMIK: "Admin Akademik",
  ADMIN_KEUANGAN: "Admin Keuangan",
  DOSEN: "Dosen",
  KAPRODI: "Kaprodi",
  MAHASISWA: "Mahasiswa",
  SUPERADMIN: "Superadmin",
};

export const getStoredActiveRole = (): string | null =>
  window.localStorage.getItem(ACTIVE_ROLE_STORAGE_KEY);

export const storeActiveRole = (role: RoleKey): void => {
  window.localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, role);
};
