import { describe, expect, test } from "bun:test";

import {
  createNationalHolidayProvider,
  parseNationalHolidayPayload,
} from "../apps/server/src/services/national-holidays";
import { createWeeklyMeetings } from "../apps/server/src/services/scheduling";
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
      canChangeMeeting(
        classStart,
        new Date("2026-10-01T16:59:59.999Z"),
        {
          leadDays: 7,
        },
        "Asia/Jakarta"
      )
    ).toBe(true);
    expect(
      canChangeMeeting(
        classStart,
        new Date("2026-10-01T17:00:00.000Z"),
        {
          leadDays: 7,
        },
        "Asia/Jakarta"
      )
    ).toBe(false);
  });

  test("handles month and year boundaries without millisecond subtraction", () => {
    expect(
      canChangeMeeting(
        new Date("2027-01-03T02:00:00.000Z"),
        new Date("2026-12-28T16:59:59.999Z"),
        { leadDays: 7 },
        "Asia/Jakarta"
      )
    ).toBe(true);
  });

  test("distinguishes invalid dates from invalid timezones", () => {
    expect(() =>
      canChangeMeeting(
        new Date("invalid"),
        new Date("2026-12-28T16:59:59.999Z"),
        { leadDays: 7 },
        "Asia/Jakarta"
      )
    ).toThrow("Tanggal penjadwalan tidak valid.");
    expect(() =>
      canChangeMeeting(
        new Date("2027-01-03T02:00:00.000Z"),
        new Date("2026-12-28T16:59:59.999Z"),
        { leadDays: 7 },
        "Invalid/Zone"
      )
    ).toThrow("Zona waktu penjadwalan tidak valid.");
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

  test("skips weekly meetings that fall inside UTS and UAS windows", () => {
    const meetings = createWeeklyMeetings({
      blackoutRanges: [
        {
          endAt: new Date("2026-10-14T03:00:00.000Z"),
          startAt: new Date("2026-10-07T00:00:00.000Z"),
        },
        {
          endAt: new Date("2026-11-25T03:00:00.000Z"),
          startAt: new Date("2026-11-18T00:00:00.000Z"),
        },
      ],
      classSectionId: "section-1",
      firstWindow: {
        endAt: new Date("2026-08-26T03:00:00.000Z"),
        startAt: new Date("2026-08-26T01:00:00.000Z"),
      },
      instructions: null,
      modality: "OFFLINE",
      roomId: "room-1",
      timeZone: "Asia/Jakarta",
    });

    expect(meetings).toHaveLength(16);
    expect(meetings.at(-1)?.sequence).toBe(16);
    expect(
      meetings.some(
        (meeting) =>
          timeRangesOverlap(
            meeting.startAt,
            meeting.endAt,
            new Date("2026-10-07T00:00:00.000Z"),
            new Date("2026-10-14T03:00:00.000Z")
          ) ||
          timeRangesOverlap(
            meeting.startAt,
            meeting.endAt,
            new Date("2026-11-18T00:00:00.000Z"),
            new Date("2026-11-25T03:00:00.000Z")
          )
      )
    ).toBe(false);
  });

  test("skips meetings whose local calendar date is a national holiday", () => {
    const meetings = createWeeklyMeetings({
      blackoutRanges: [],
      classSectionId: "section-1",
      firstWindow: {
        endAt: new Date("2026-09-02T03:00:00.000Z"),
        startAt: new Date("2026-09-02T01:00:00.000Z"),
      },
      holidayDates: ["2026-09-02"],
      instructions: null,
      modality: "ONLINE",
      roomId: null,
      timeZone: "Asia/Jakarta",
    });

    expect(meetings).toHaveLength(16);
    expect(meetings[0]?.startAt.toISOString()).toBe("2026-09-09T01:00:00.000Z");
  });

  test("normalizes the public national holiday response", () => {
    expect(
      parseNationalHolidayPayload({
        data: [
          {
            date: "2026-05-28",
            is_cuti_bersama: true,
            name: "Idul Adha 1447 Hijriah",
          },
        ],
      })
    ).toEqual([
      {
        date: "2026-05-28",
        isJointLeave: true,
        name: "Idul Adha 1447 Hijriah",
        source: "PUBLIC_API",
        sourceUrl: "https://api.kemendesa.link/libur-nasional/api/holidays",
      },
    ]);
  });

  test("uses the official fallback when the public API has no 2027 data", async () => {
    const provider = createNationalHolidayProvider({
      fetcher: () => Promise.resolve(new Response(null, { status: 404 })),
    });

    const holidays = await provider.getNationalHolidays(2027);

    expect(holidays).toHaveLength(26);
    expect(holidays[0]).toMatchObject({
      date: "2027-01-01",
      isJointLeave: false,
      source: "OFFICIAL_FALLBACK",
    });
    expect(holidays.at(-1)).toMatchObject({
      date: "2027-12-26",
      isJointLeave: false,
      source: "OFFICIAL_FALLBACK",
    });
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

  test("allows an approved draft to be published", () => {
    expect(() =>
      assertScheduleTransition("APPROVED", "PUBLISHED")
    ).not.toThrow();
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
