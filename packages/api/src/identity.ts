import { roleKeys as catalogRoleKeys } from "@siakad-itbkmmubar/db/schema/identity";

export const identityTypes = [
  "MAHASISWA",
  "DOSEN",
  "ADMIN_AKADEMIK",
  "ADMIN_KEUANGAN",
  "SUPERADMIN",
] as const;

export const roleKeys = catalogRoleKeys;
export const scopeTypes = ["PRODI", "KELAS", "OWNERSHIP"] as const;

export const PASSWORD_MINIMUM_LENGTH = 16;
export const DEFAULT_TEMPORARY_PASSWORD_TTL_MS = 60 * 60 * 24 * 7 * 1000;
export const IDENTIFIER_SEQUENCE_MAX = 999;
export const JAKARTA_TIME_ZONE = "Asia/Jakarta";

export type IdentityType =
  | "MAHASISWA"
  | "DOSEN"
  | "ADMIN_AKADEMIK"
  | "ADMIN_KEUANGAN"
  | "SUPERADMIN";

export type RoleKey = (typeof roleKeys)[number];

export class IdentityDomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "IdentityDomainError";
  }
}

export const normalizeIdentifier = (value: string): string => {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9]+$/u.test(normalized)) {
    throw new IdentityDomainError(
      "INVALID_IDENTIFIER",
      "Identifier hanya boleh berisi huruf dan angka."
    );
  }
  return normalized;
};

export const getJakartaDate = (date: Date): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: JAKARTA_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return `${values.year ?? "0000"}${values.month ?? "00"}${values.day ?? "00"}`;
};

export const formatInstitutionalIdentifier = (
  prefix: string,
  sequenceDate: string,
  sequenceNumber: number
): string => {
  const normalizedPrefix = prefix.trim().toUpperCase();
  if (!/^[A-Z]{3}$/u.test(normalizedPrefix)) {
    throw new IdentityDomainError(
      "INVALID_IDENTIFIER_PREFIX",
      "Prefix identifier harus terdiri dari tiga huruf uppercase."
    );
  }
  if (!/^\d{8}$/u.test(sequenceDate)) {
    throw new IdentityDomainError(
      "INVALID_IDENTIFIER_DATE",
      "Tanggal identifier harus berformat YYYYMMDD."
    );
  }
  if (
    !Number.isInteger(sequenceNumber) ||
    sequenceNumber < 1 ||
    sequenceNumber > IDENTIFIER_SEQUENCE_MAX
  ) {
    throw new IdentityDomainError(
      "IDENTIFIER_SEQUENCE_OVERFLOW",
      "Sequence identifier untuk tanggal tersebut sudah mencapai batas."
    );
  }
  return `${normalizedPrefix}${sequenceDate}${String(sequenceNumber).padStart(3, "0")}`;
};

export interface IdentifierPreview {
  identifier: string;
  masterRecordId: string;
  sequenceNumber: number;
}

export const previewIdentifierAllocations = ({
  masterRecordIds,
  prefix,
  sequenceDate,
  startSequence,
}: {
  masterRecordIds: readonly string[];
  prefix: string;
  sequenceDate: string;
  startSequence: number;
}): IdentifierPreview[] => {
  const uniqueMasterRecordIds = [...new Set(masterRecordIds)].toSorted((a, b) =>
    a.localeCompare(b)
  );
  if (
    startSequence < 1 ||
    startSequence + uniqueMasterRecordIds.length - 1 > IDENTIFIER_SEQUENCE_MAX
  ) {
    throw new IdentityDomainError(
      "IDENTIFIER_SEQUENCE_OVERFLOW",
      "Jumlah identifier yang diminta melebihi sequence yang tersedia."
    );
  }
  return uniqueMasterRecordIds.map((masterRecordId, index) => {
    const sequenceNumber = startSequence + index;
    return {
      identifier: formatInstitutionalIdentifier(
        prefix,
        sequenceDate,
        sequenceNumber
      ),
      masterRecordId,
      sequenceNumber,
    };
  });
};

export const isKnownRole = (value: string): value is RoleKey =>
  roleKeys.includes(value as RoleKey);

export const assertKnownRole: (value: string) => asserts value is RoleKey = (
  value
) => {
  if (!isKnownRole(value)) {
    throw new IdentityDomainError(
      "UNKNOWN_ROLE",
      "Role yang diminta tidak terdaftar pada katalog sistem."
    );
  }
};

export const assertRoleConflictFree = (
  activeRoles: readonly string[],
  requestedRole: string
): void => {
  assertKnownRole(requestedRole);
  if (
    (requestedRole === "ADMIN_AKADEMIK" &&
      activeRoles.includes("ADMIN_KEUANGAN")) ||
    (requestedRole === "ADMIN_KEUANGAN" &&
      activeRoles.includes("ADMIN_AKADEMIK"))
  ) {
    throw new IdentityDomainError(
      "ROLE_CONFLICT",
      "ADMIN_AKADEMIK dan ADMIN_KEUANGAN tidak dapat aktif pada akun yang sama."
    );
  }
};

export const assertProvisioningPermission = (
  actorRoles: readonly string[],
  targetIdentityType: IdentityType
): void => {
  const isSuperadmin = actorRoles.includes("SUPERADMIN");
  const isAcademicAdmin = actorRoles.includes("ADMIN_AKADEMIK");
  const allowedForAcademicAdmin =
    targetIdentityType === "MAHASISWA" || targetIdentityType === "DOSEN";

  if (!isSuperadmin && !(isAcademicAdmin && allowedForAcademicAdmin)) {
    throw new IdentityDomainError(
      "FORBIDDEN_PROVISIONING",
      "Role aktif Anda tidak dapat memprovision akun dengan tipe tersebut."
    );
  }
};

export const maskIpAddress = (ipAddress: string | null | undefined): string => {
  if (!ipAddress) {
    return "Tidak tersedia";
  }
  if (ipAddress.includes(":")) {
    const segments = ipAddress.split(":");
    return `${segments.slice(0, 2).join(":")}::[disamarkan]`;
  }
  const segments = ipAddress.split(".");
  return segments.length === 4
    ? `${segments[0]}.${segments[1]}.x.x`
    : "[disamarkan]";
};
