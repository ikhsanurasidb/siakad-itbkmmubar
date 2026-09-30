import { describe, expect, test } from "bun:test";

import {
  IDENTIFIER_SEQUENCE_MAX,
  IdentityDomainError,
  assertKnownRole,
  assertProvisioningPermission,
  assertResetPasswordPermission,
  assertRoleConflictFree,
  formatInstitutionalIdentifier,
  getDateInTimeZone,
  normalizeIdentifier,
  normalizePhoneNumber,
  previewIdentifierAllocations,
  resolveActiveRoles,
} from "../packages/api/src/identity";

describe("SIAKAD-01 identity rules", () => {
  test("normalizes identifiers before validation", () => {
    expect(normalizeIdentifier("  dsn20260928001 ")).toBe("DSN20260928001");
    expect(() => normalizeIdentifier("DSN-20260928001")).toThrow(
      "Identifier hanya boleh berisi huruf dan angka."
    );
  });

  test("uses the configured timezone for the provisioning identifier", () => {
    expect(
      getDateInTimeZone(new Date("2026-09-27T17:30:00.000Z"), "Asia/Jakarta")
    ).toBe("20260928");
    expect(formatInstitutionalIdentifier("dsn", "20260928", 1)).toBe(
      "DSN20260928001"
    );
  });

  test("allocates bulk identifiers deterministically and rejects overflow", () => {
    expect(
      previewIdentifierAllocations({
        masterRecordIds: ["master-b", "master-a", "master-b"],
        prefix: "DSN",
        sequenceDate: "20260928",
        startSequence: 1,
      })
    ).toEqual([
      {
        identifier: "DSN20260928001",
        masterRecordId: "master-a",
        sequenceNumber: 1,
      },
      {
        identifier: "DSN20260928002",
        masterRecordId: "master-b",
        sequenceNumber: 2,
      },
    ]);
    expect(() =>
      formatInstitutionalIdentifier(
        "DSN",
        "20260928",
        IDENTIFIER_SEQUENCE_MAX + 1
      )
    ).toThrow(IdentityDomainError);
  });

  test("rejects the academic and finance administrator role conflict", () => {
    expect(() =>
      assertRoleConflictFree(["ADMIN_KEUANGAN"], "ADMIN_AKADEMIK")
    ).toThrow("ADMIN_AKADEMIK dan ADMIN_KEUANGAN");
    expect(() => assertKnownRole("STAFF")).toThrow("tidak terdaftar");
  });

  test("limits administrator provisioning to academic administrators", () => {
    expect(() =>
      assertProvisioningPermission(["SUPERADMIN"], "ADMIN_AKADEMIK")
    ).not.toThrow();
    expect(() =>
      assertProvisioningPermission(["SUPERADMIN"], "ADMIN_KEUANGAN")
    ).toThrow("Role aktif Anda");
    expect(() =>
      assertProvisioningPermission(["SUPERADMIN"], "SUPERADMIN")
    ).toThrow("Role aktif Anda");
  });

  test("lets superadmin choose a constrained active role", () => {
    expect(resolveActiveRoles(["SUPERADMIN"], "ADMIN_AKADEMIK")).toEqual({
      activeRole: "ADMIN_AKADEMIK",
      availableRoles: ["SUPERADMIN", "ADMIN_AKADEMIK"],
      effectiveRoles: ["ADMIN_AKADEMIK"],
    });
    expect(resolveActiveRoles(["SUPERADMIN"], "ADMIN_KEUANGAN")).toEqual({
      activeRole: "SUPERADMIN",
      availableRoles: ["SUPERADMIN", "ADMIN_AKADEMIK"],
      effectiveRoles: ["SUPERADMIN"],
    });
    expect(resolveActiveRoles(["DOSEN", "KAPRODI"], "SUPERADMIN")).toEqual({
      activeRole: "DOSEN",
      availableRoles: ["DOSEN", "KAPRODI"],
      effectiveRoles: ["DOSEN", "KAPRODI"],
    });
  });

  test("enforces the reset-password target matrix", () => {
    expect(() =>
      assertResetPasswordPermission("ADMIN_AKADEMIK", "MAHASISWA")
    ).not.toThrow();
    expect(() =>
      assertResetPasswordPermission("ADMIN_AKADEMIK", "DOSEN")
    ).not.toThrow();
    expect(() =>
      assertResetPasswordPermission("SUPERADMIN", "ADMIN_AKADEMIK")
    ).not.toThrow();
    expect(() =>
      assertResetPasswordPermission("ADMIN_AKADEMIK", "ADMIN_AKADEMIK")
    ).toThrow("tidak dapat mengatur ulang");
    expect(() => assertResetPasswordPermission("SUPERADMIN", "DOSEN")).toThrow(
      "tidak dapat mengatur ulang"
    );
    expect(() => assertResetPasswordPermission(null, "MAHASISWA")).toThrow(
      "tidak dapat mengatur ulang"
    );
  });

  test("normalizes and validates phone numbers for identity accounts", () => {
    expect(normalizePhoneNumber(" +62 (812) 3456-7890 ")).toBe(
      "+6281234567890"
    );
    expect(normalizePhoneNumber("081234567890")).toBe("081234567890");
    expect(() => normalizePhoneNumber("123")).toThrow("Nomor telepon");
  });
});
