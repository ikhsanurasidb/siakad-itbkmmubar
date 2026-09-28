import { describe, expect, test } from "bun:test";

import {
  LmsDomainError,
  assertLmsManageRole,
  assertPublishedForStudent,
  decodeLmsCursor,
  determineSubmissionStatus,
  encodeLmsCursor,
  normalizeLmsBody,
  normalizeLmsTitle,
} from "../packages/api/src/lms";

describe("SIAKAD-07 LMS rules", () => {
  test("uses the server submission time to determine late status", () => {
    expect(
      determineSubmissionStatus(
        new Date("2026-10-01T10:00:00Z"),
        new Date("2026-10-01T10:00:00Z")
      )
    ).toEqual({ isLate: false, status: "SUBMITTED" });
    expect(
      determineSubmissionStatus(
        new Date("2026-10-01T10:00:01Z"),
        new Date("2026-10-01T10:00:00Z")
      )
    ).toEqual({ isLate: true, status: "LATE" });
  });

  test("hides draft content from student-facing reads", () => {
    expect(() => assertPublishedForStudent("DRAFT", true)).toThrow(
      LmsDomainError
    );
    expect(() => assertPublishedForStudent("PUBLISHED", true)).not.toThrow();
    expect(() => assertPublishedForStudent("DRAFT", false)).not.toThrow();
  });

  test("requires teaching roles to manage LMS content", () => {
    expect(() => assertLmsManageRole(["MAHASISWA"])).toThrow(LmsDomainError);
    expect(() => assertLmsManageRole(["DOSEN"])).not.toThrow();
  });

  test("normalizes content and rejects oversized text", () => {
    expect(normalizeLmsTitle("  Materi   minggu 1 ")).toBe("Materi minggu 1");
    expect(normalizeLmsBody("  Ringkasan materi  ")).toBe("Ringkasan materi");
    expect(normalizeLmsBody("   ")).toBeNull();
    expect(() => normalizeLmsTitle("")).toThrow(LmsDomainError);
  });

  test("round-trips cursor pagination state", () => {
    const createdAt = new Date("2026-10-01T10:00:00Z");
    const cursor = encodeLmsCursor(createdAt, "thread-1");
    expect(decodeLmsCursor(cursor)).toEqual({ createdAt, id: "thread-1" });
    expect(() => decodeLmsCursor("invalid")).toThrow(LmsDomainError);
  });
});
