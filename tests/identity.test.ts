import { describe, expect, test } from "bun:test";

import {
  IDENTIFIER_SEQUENCE_MAX,
  IdentityDomainError,
  assertKnownRole,
  assertRoleConflictFree,
  formatInstitutionalIdentifier,
  getJakartaDate,
  normalizeIdentifier,
  previewIdentifierAllocations,
} from "../packages/api/src/identity";

describe("SIAKAD-01 identity rules", () => {
  test("normalizes identifiers before validation", () => {
    expect(normalizeIdentifier("  dsn20260928001 ")).toBe("DSN20260928001");
    expect(() => normalizeIdentifier("DSN-20260928001")).toThrow(
      "Identifier hanya boleh berisi huruf dan angka."
    );
  });

  test("uses Asia/Jakarta date for the provisioning identifier", () => {
    expect(getJakartaDate(new Date("2026-09-27T17:30:00.000Z"))).toBe(
      "20260928"
    );
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
});
