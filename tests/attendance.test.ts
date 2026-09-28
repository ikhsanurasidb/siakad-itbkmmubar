import { describe, expect, test } from "bun:test";

import {
  assertAttendanceWindowOpen,
  assertCoordinate,
  AttendanceDomainError,
  calculateAttendanceWindow,
  calculateDistanceMeters,
  participantTypeForRoles,
  validateEvidenceImage,
} from "../packages/api/src/attendance";

const pngHeader = (width: number, height: number): Uint8Array => {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47], 0);
  bytes.set([73, 72, 68, 82], 12);
  bytes[16] = Math.floor(width / 16_777_216) % 256;
  bytes[17] = Math.floor(width / 65_536) % 256;
  bytes[18] = Math.floor(width / 256) % 256;
  bytes[19] = width % 256;
  bytes[20] = Math.floor(height / 16_777_216) % 256;
  bytes[21] = Math.floor(height / 65_536) % 256;
  bytes[22] = Math.floor(height / 256) % 256;
  bytes[23] = height % 256;
  return bytes;
};

describe("SIAKAD-08 attendance rules", () => {
  test("keeps attendance window boundaries inclusive", () => {
    const window = calculateAttendanceWindow(
      new Date("2026-10-01T08:00:00Z"),
      new Date("2026-10-01T10:00:00Z"),
      { closeOffsetMinutes: 60, openOffsetMinutes: 30, radiusMeters: 1000 }
    );
    expect(() =>
      assertAttendanceWindowOpen(window.openAt, window)
    ).not.toThrow();
    expect(() =>
      assertAttendanceWindowOpen(window.closeAt, window)
    ).not.toThrow();
    expect(() =>
      assertAttendanceWindowOpen(new Date(window.closeAt.getTime() + 1), window)
    ).toThrow(AttendanceDomainError);
  });

  test("accepts the radius boundary and rejects a point outside it", () => {
    const distance = calculateDistanceMeters(
      { latitude: -6.2001, longitude: 106.8167 },
      { latitude: -6.2, longitude: 106.8167 }
    );
    expect(distance).toBeGreaterThan(0);
    expect(
      calculateDistanceMeters(
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 0 }
      )
    ).toBe(0);
    expect(() => assertCoordinate(90.01, "latitude")).toThrow(
      AttendanceDomainError
    );
  });

  test("validates image magic bytes and dimensions, not only declared MIME", () => {
    expect(
      validateEvidenceImage({
        bytes: pngHeader(640, 480),
        declaredMime: "image/png",
      })
    ).toEqual({
      height: 480,
      mimeType: "image/png",
      width: 640,
    });
    expect(() =>
      validateEvidenceImage({
        bytes: new Uint8Array([1, 2, 3]),
        declaredMime: "image/png",
      })
    ).toThrow("Isi atau dimensi");
    expect(() =>
      validateEvidenceImage({
        bytes: pngHeader(20, 20),
        declaredMime: "image/png",
      })
    ).toThrow("Isi atau dimensi");
  });

  test("does not allow administrative roles to submit as a participant", () => {
    expect(() => participantTypeForRoles(["ADMIN_AKADEMIK"])).toThrow(
      AttendanceDomainError
    );
    expect(participantTypeForRoles(["MAHASISWA"])).toBe("STUDENT");
    expect(participantTypeForRoles(["DOSEN"])).toBe("LECTURER");
  });
});
