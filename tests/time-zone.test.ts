import { describe, expect, test } from "bun:test";

import {
  getDateTimePartsInTimeZone,
  parseLocalDateTime,
} from "../packages/api/src/time-zone";

describe("timezone utilities", () => {
  test("converts a local date/time using the configured timezone", () => {
    expect(
      parseLocalDateTime("2026-09-28T00:30:00", "Asia/Jakarta").toISOString()
    ).toBe("2026-09-27T17:30:00.000Z");
  });

  test("resolves daylight-saving offsets instead of using a fixed offset", () => {
    expect(
      parseLocalDateTime(
        "2026-07-01T09:00:00",
        "America/New_York"
      ).toISOString()
    ).toBe("2026-07-01T13:00:00.000Z");
    expect(
      parseLocalDateTime(
        "2026-01-01T09:00:00",
        "America/New_York"
      ).toISOString()
    ).toBe("2026-01-01T14:00:00.000Z");
  });

  test("returns the configured timezone's calendar and clock parts", () => {
    expect(
      getDateTimePartsInTimeZone(
        new Date("2026-09-27T17:30:00.123Z"),
        "Asia/Jakarta"
      )
    ).toEqual({
      day: 28,
      hour: 0,
      millisecond: 123,
      minute: 30,
      month: 9,
      second: 0,
      year: 2026,
    });
  });

  test("rejects invalid timezone and local date/time values", () => {
    expect(() =>
      parseLocalDateTime("2026-09-28T00:30:00", "Invalid/Zone")
    ).toThrow("Invalid time zone");
    expect(() => parseLocalDateTime("2026-09-28T99:30:00", "UTC")).toThrow(
      "Invalid local date/time"
    );
  });
});
