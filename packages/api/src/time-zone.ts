export interface TimeZoneDateParts {
  day: number;
  hour: number;
  millisecond: number;
  minute: number;
  month: number;
  second: number;
  year: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

const getDateTimeFormatter = (timeZone: string): Intl.DateTimeFormat => {
  const existing = formatters.get(timeZone);
  if (existing) {
    return existing;
  }
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      fractionalSecondDigits: 3,
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      second: "2-digit",
      timeZone,
      year: "numeric",
    });
  } catch {
    throw new RangeError(`Invalid time zone: ${timeZone}`);
  }
  formatters.set(timeZone, formatter);
  return formatter;
};

export const assertValidTimeZone = (timeZone: string): string => {
  getDateTimeFormatter(timeZone);
  return timeZone;
};

export const getDateTimePartsInTimeZone = (
  value: Date,
  timeZone: string
): TimeZoneDateParts => {
  if (Number.isNaN(value.getTime())) {
    throw new RangeError("Invalid date");
  }
  const values = new Map(
    getDateTimeFormatter(timeZone)
      .formatToParts(value)
      .map((part) => [part.type, part.value])
  );
  const parts = {
    day: Number(values.get("day")),
    hour: Number(values.get("hour")),
    millisecond: Number(values.get("fractionalSecond")),
    minute: Number(values.get("minute")),
    month: Number(values.get("month")),
    second: Number(values.get("second")),
    year: Number(values.get("year")),
  };
  if (Object.values(parts).some((part) => !Number.isInteger(part))) {
    throw new RangeError("Could not determine date parts for time zone");
  }
  return parts;
};

export const getDatePartsInTimeZone = (
  value: Date,
  timeZone: string
): Pick<TimeZoneDateParts, "day" | "month" | "year"> => {
  const { day, month, year } = getDateTimePartsInTimeZone(value, timeZone);
  return { day, month, year };
};

const localDateTimePattern =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)?$/u;

/** Converts a wall-clock date/time in the configured IANA timezone to UTC. */
export const parseLocalDateTime = (value: string, timeZone: string): Date => {
  const normalizedValue = value.includes("T") ? value : `${value}T00:00:00`;
  if (!localDateTimePattern.test(normalizedValue)) {
    throw new RangeError("Invalid local date/time");
  }
  const wallClockAsUtc = new Date(`${normalizedValue}Z`);
  if (Number.isNaN(wallClockAsUtc.getTime())) {
    throw new RangeError("Invalid local date/time");
  }
  let result = wallClockAsUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = getDateTimePartsInTimeZone(result, timeZone);
    const localAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      parts.millisecond
    );
    const offset = localAsUtc - result.getTime();
    result = new Date(wallClockAsUtc.getTime() - offset);
  }
  return result;
};
