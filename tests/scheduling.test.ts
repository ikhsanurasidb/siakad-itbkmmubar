import { describe, expect, test } from "bun:test";

import {
  SchedulingDomainError,
  assertOnlineMeetingChange,
  assertScheduleTransition,
  canChangeMeeting,
  splitEnrollmentIds,
  timeRangesOverlap,
} from "../packages/api/src/scheduling";

describe("SIAKAD-06 scheduling rules", () => {
  test("uses inclusive local calendar days for the H-7 cutoff", () => {
    const classStart = new Date("2026-10-07T02:00:00.000Z");
    expect(
      canChangeMeeting(classStart, new Date("2026-10-01T16:59:59.999Z"), {
        leadDays: 7,
      })
    ).toBe(true);
    expect(
      canChangeMeeting(classStart, new Date("2026-10-01T17:00:00.000Z"), {
        leadDays: 7,
      })
    ).toBe(false);
  });

  test("handles month and year boundaries without millisecond subtraction", () => {
    expect(
      canChangeMeeting(
        new Date("2027-01-03T02:00:00.000Z"),
        new Date("2026-12-28T16:59:59.999Z"),
        { leadDays: 7 }
      )
    ).toBe(true);
  });

  test("treats schedule ranges as half-open intervals", () => {
    expect(
      timeRangesOverlap(
        new Date("2026-10-01T01:00:00Z"),
        new Date("2026-10-01T02:00:00Z"),
        new Date("2026-10-01T02:00:00Z"),
        new Date("2026-10-01T03:00:00Z")
      )
    ).toBe(false);
  });

  test("splits student enrollments deterministically by class capacity", () => {
    expect(splitEnrollmentIds(["1", "2", "3", "4", "5"], 2)).toEqual([
      ["1", "2"],
      ["3", "4"],
      ["5"],
    ]);
  });

  test("blocks submitted schedules that still have blocking conflicts", () => {
    expect(() =>
      assertScheduleTransition("DRAFT", "SUBMITTED", {
        hasBlockingConflicts: true,
      })
    ).toThrow(SchedulingDomainError);
  });

  test("requires usable online meeting details and an HTTPS URL", () => {
    expect(() =>
      assertOnlineMeetingChange({
        currentOnlineMeetings: 0,
        maximumOnlineMeetings: 2,
      })
    ).toThrow(SchedulingDomainError);
    expect(() =>
      assertOnlineMeetingChange({
        currentOnlineMeetings: 0,
        maximumOnlineMeetings: 2,
        onlineUrl: "http://example.test",
      })
    ).toThrow(SchedulingDomainError);
    expect(() =>
      assertOnlineMeetingChange({
        currentOnlineMeetings: 2,
        instructions: "Ruang virtual institusi",
        maximumOnlineMeetings: 2,
      })
    ).toThrow(SchedulingDomainError);
  });
});
