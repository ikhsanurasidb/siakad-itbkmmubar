import type { ScheduleHolidayRecord } from "@api/scheduling";

export const NATIONAL_HOLIDAY_SOURCE_URL =
  "https://api.kemendesa.link/libur-nasional/api/holidays";

export const OFFICIAL_2027_SOURCE_URL =
  "https://setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2027";

interface HolidayApiItem {
  date?: unknown;
  is_cuti_bersama?: unknown;
  name?: unknown;
}

interface HolidayApiPayload {
  data?: unknown;
}

const OFFICIAL_HOLIDAY_FALLBACKS: Readonly<
  Record<number, readonly ScheduleHolidayRecord[]>
> = {
  2027: [
    {
      date: "2027-01-01",
      isJointLeave: false,
      name: "Tahun Baru 2027 Masehi",
      source: "OFFICIAL_FALLBACK",
      sourceUrl: OFFICIAL_2027_SOURCE_URL,
    },
    {
      date: "2027-01-05",
      isJointLeave: false,
      name: "Isra Mikraj Nabi Muhammad saw.",
      source: "OFFICIAL_FALLBACK",
      sourceUrl: OFFICIAL_2027_SOURCE_URL,
    },
    {
      date: "2027-02-05",
      isJointLeave: true,
      name: "Tahun Baru Imlek 2578 Kongzili",
      source: "OFFICIAL_FALLBACK",
      sourceUrl: OFFICIAL_2027_SOURCE_URL,
    },
    {
      date: "2027-02-06",
      isJointLeave: false,
      name: "Tahun Baru Imlek 2578 Kongzili",
      source: "OFFICIAL_FALLBACK",
      sourceUrl: OFFICIAL_2027_SOURCE_URL,
    },
    {
      date: "2027-03-08",
      isJointLeave: false,
      name: "Hari Suci Nyepi (Tahun Baru Saka 1949)",
      source: "OFFICIAL_FALLBACK",
      sourceUrl: OFFICIAL_2027_SOURCE_URL,
    },
    {
      date: "2027-03-09",
      isJointLeave: true,
      name: "Idulfitri 1448 Hijriah",
      source: "OFFICIAL_FALLBACK",
      sourceUrl: OFFICIAL_2027_SOURCE_URL,
    },
    {
      date: "2027-03-10",
      isJointLeave: false,
      name: "Idulfitri 1448 Hijriah",
      source: "OFFICIAL_FALLBACK",
      sourceUrl: OFFICIAL_2027_SOURCE_URL,
    },
    {
      date: "2027-03-11",
      isJointLeave: false,
      name: "Idulfitri 1448 Hijriah",
      source: "OFFICIAL_FALLBACK",
      sourceUrl: OFFICIAL_2027_SOURCE_URL,
    },
    {
      date: "2027-03-12",
      isJointLeave: true,
      name: "Idulfitri 1448 Hijriah",
      source: "OFFICIAL_FALLBACK",
      sourceUrl: OFFICIAL_2027_SOURCE_URL,
    },
    {
      date: "2027-03-15",
      isJointLeave: true,
      name: "Idulfitri 1448 Hijriah",
      source: "OFFICIAL_FALLBACK",
      sourceUrl: OFFICIAL_2027_SOURCE_URL,
    },
    {
      date: "2027-03-25",
      isJointLeave: true,
      name: "Wafat Yesus Kristus",
      source: "OFFICIAL_FALLBACK",
      sourceUrl: OFFICIAL_2027_SOURCE_URL,
    },
    {
      date: "2027-03-26",
      isJointLeave: false,
      name: "Wafat Yesus Kristus",
      source: "OFFICIAL_FALLBACK",
      sourceUrl: OFFICIAL_2027_SOURCE_URL,
    },
    {
      date: "2027-03-28",
      isJointLeave: false,
      name: "Hari Kebangkitan Yesus Kristus (Paskah)",
      source: "OFFICIAL_FALLBACK",
      sourceUrl: OFFICIAL_2027_SOURCE_URL,
    },
    {
      date: "2027-05-01",
      isJointLeave: false,
      name: "Hari Buruh Internasional",
      source: "OFFICIAL_FALLBACK",
      sourceUrl: OFFICIAL_2027_SOURCE_URL,
    },
    {
      date: "2027-05-06",
      isJointLeave: false,
      name: "Kenaikan Yesus Kristus",
      source: "OFFICIAL_FALLBACK",
      sourceUrl: OFFICIAL_2027_SOURCE_URL,
    },
    {
      date: "2027-05-17",
      isJointLeave: false,
      name: "Iduladha 1448 Hijriah",
      source: "OFFICIAL_FALLBACK",
      sourceUrl: OFFICIAL_2027_SOURCE_URL,
    },
    {
      date: "2027-05-18",
      isJointLeave: true,
      name: "Idul Adha 1448 H",
      source: "OFFICIAL_FALLBACK",
      sourceUrl: OFFICIAL_2027_SOURCE_URL,
    },
    {
      date: "2027-05-19",
      isJointLeave: true,
      name: "Hari Raya Waisak 2571 BE",
      source: "OFFICIAL_FALLBACK",
      sourceUrl: OFFICIAL_2027_SOURCE_URL,
    },
    {
      date: "2027-05-20",
      isJointLeave: false,
      name: "Hari Raya Waisak 2571 BE",
      source: "OFFICIAL_FALLBACK",
      sourceUrl: OFFICIAL_2027_SOURCE_URL,
    },
    {
      date: "2027-06-01",
      isJointLeave: false,
      name: "Hari Lahir Pancasila",
      source: "OFFICIAL_FALLBACK",
      sourceUrl: OFFICIAL_2027_SOURCE_URL,
    },
    {
      date: "2027-06-06",
      isJointLeave: false,
      name: "1 Muharam Tahun Baru Islam 1449 Hijriah",
      source: "OFFICIAL_FALLBACK",
      sourceUrl: OFFICIAL_2027_SOURCE_URL,
    },
    {
      date: "2027-08-15",
      isJointLeave: false,
      name: "Maulid Nabi Muhammad SAW",
      source: "OFFICIAL_FALLBACK",
      sourceUrl: OFFICIAL_2027_SOURCE_URL,
    },
    {
      date: "2027-08-17",
      isJointLeave: false,
      name: "Proklamasi Kemerdekaan",
      source: "OFFICIAL_FALLBACK",
      sourceUrl: OFFICIAL_2027_SOURCE_URL,
    },
    {
      date: "2027-12-24",
      isJointLeave: true,
      name: "Kelahiran Yesus Kristus (Natal)",
      source: "OFFICIAL_FALLBACK",
      sourceUrl: OFFICIAL_2027_SOURCE_URL,
    },
    {
      date: "2027-12-25",
      isJointLeave: false,
      name: "Kelahiran Yesus Kristus (Natal)",
      source: "OFFICIAL_FALLBACK",
      sourceUrl: OFFICIAL_2027_SOURCE_URL,
    },
    {
      date: "2027-12-26",
      isJointLeave: false,
      name: "Isra Mikraj Nabi Muhammad SAW 1449 Hijriah",
      source: "OFFICIAL_FALLBACK",
      sourceUrl: OFFICIAL_2027_SOURCE_URL,
    },
  ],
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isDateOnly = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value);

const isHolidayApiItem = (value: unknown): value is HolidayApiItem =>
  isRecord(value);

export const parseNationalHolidayPayload = (
  payload: unknown,
  sourceUrl = NATIONAL_HOLIDAY_SOURCE_URL
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
        source: "PUBLIC_API" as const,
        sourceUrl,
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

const getOfficialHolidayFallback = (
  year: number
): readonly ScheduleHolidayRecord[] | undefined =>
  OFFICIAL_HOLIDAY_FALLBACKS[year];

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
          const fallback = getOfficialHolidayFallback(year);
          if (fallback) {
            return fallback;
          }
          throw new Error(
            `Kalender libur nasional tahun ${year} tidak tersedia (${response.status}).`
          );
        }
        return parseNationalHolidayPayload(
          (await response.json()) as unknown,
          `${NATIONAL_HOLIDAY_SOURCE_URL}/${year}.json`
        );
      } catch (error: unknown) {
        const fallback = getOfficialHolidayFallback(year);
        if (fallback) {
          return fallback;
        }
        holidayCache.delete(year);
        throw error;
      }
    })();
    holidayCache.set(year, request);
    return request;
  };

  return { getNationalHolidays };
};
