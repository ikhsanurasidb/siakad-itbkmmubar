import type { ScheduleHolidayRecord } from "@api/scheduling";

export const NATIONAL_HOLIDAY_SOURCE_URL =
  "https://api.kemendesa.link/libur-nasional/api/holidays";

interface HolidayApiItem {
  date?: unknown;
  is_cuti_bersama?: unknown;
  name?: unknown;
}

interface HolidayApiPayload {
  data?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isDateOnly = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value);

const isHolidayApiItem = (value: unknown): value is HolidayApiItem =>
  isRecord(value);

export const parseNationalHolidayPayload = (
  payload: unknown
): readonly ScheduleHolidayRecord[] => {
  if (!isRecord(payload)) {
    throw new Error("Format kalender libur nasional tidak valid.");
  }
  const { data } = payload as HolidayApiPayload;
  if (!Array.isArray(data)) {
    throw new TypeError("Data kalender libur nasional tidak tersedia.");
  }
  const holidays = data.flatMap((item) => {
    if (!isHolidayApiItem(item)) {
      return [];
    }
    const { date } = item;
    const { name } = item;
    if (!isDateOnly(date) || typeof name !== "string" || name.trim() === "") {
      return [];
    }
    return [
      {
        date,
        isJointLeave: item.is_cuti_bersama === true,
        name: name.trim(),
      },
    ];
  });
  if (holidays.length !== data.length) {
    throw new Error("Sebagian data kalender libur nasional tidak valid.");
  }
  return holidays.toSorted((left, right) =>
    left.date.localeCompare(right.date)
  );
};

export const createNationalHolidayProvider = ({
  fetcher = fetch,
}: {
  fetcher?: typeof fetch;
} = {}) => {
  const holidayCache = new Map<
    number,
    Promise<readonly ScheduleHolidayRecord[]>
  >();

  const getNationalHolidays = (
    year: number
  ): Promise<readonly ScheduleHolidayRecord[]> => {
    const cached = holidayCache.get(year);
    if (cached) {
      return cached;
    }
    const request = (async () => {
      try {
        const response = await fetcher(
          `${NATIONAL_HOLIDAY_SOURCE_URL}/${year}.json`
        );
        if (!response.ok) {
          throw new Error(
            `Kalender libur nasional tahun ${year} tidak tersedia (${response.status}).`
          );
        }
        return parseNationalHolidayPayload((await response.json()) as unknown);
      } catch (error: unknown) {
        holidayCache.delete(year);
        throw error;
      }
    })();
    holidayCache.set(year, request);
    return request;
  };

  return { getNationalHolidays };
};
