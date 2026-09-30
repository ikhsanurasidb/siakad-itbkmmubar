import type { ScheduleHolidayRecord } from "@siakad-itbkmmubar/api/scheduling";
import {
  getDatePartsInTimeZone,
  parseLocalDateTime,
} from "@siakad-itbkmmubar/api/time-zone";
import { Button } from "@siakad-itbkmmubar/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@siakad-itbkmmubar/ui/components/card";
import { Input } from "@siakad-itbkmmubar/ui/components/input";
import { PageHeader } from "@siakad-itbkmmubar/ui/components/page-header";
import { State } from "@siakad-itbkmmubar/ui/components/state";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ExternalLink,
  Info,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import { ENV } from "@/env.public";
import { orpc } from "@/utils/orpc";

const MIN_CALENDAR_YEAR = 2000;
const MAX_CALENDAR_YEAR = 2100;
const currentYear = Number(
  new Intl.DateTimeFormat("en-US", {
    timeZone: ENV.VITE_BUSINESS_TIME_ZONE,
    year: "numeric",
  }).format(new Date())
);

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  timeZone: ENV.VITE_BUSINESS_TIME_ZONE,
  weekday: "long",
  year: "numeric",
});

const monthFormatter = new Intl.DateTimeFormat("id-ID", {
  month: "long",
  timeZone: ENV.VITE_BUSINESS_TIME_ZONE,
  year: "numeric",
});

interface HolidayMonthGroup {
  holidays: readonly ScheduleHolidayRecord[];
  key: string;
  label: string;
}

const formatHolidayDate = (date: string): string =>
  dateFormatter.format(parseLocalDateTime(date, ENV.VITE_BUSINESS_TIME_ZONE));

const groupHolidaysByMonth = (
  holidays: readonly ScheduleHolidayRecord[]
): readonly HolidayMonthGroup[] => {
  const groups = new Map<string, ScheduleHolidayRecord[]>();
  for (const holiday of holidays) {
    const key = holiday.date.slice(0, 7);
    const group = groups.get(key) ?? [];
    group.push(holiday);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, group]) => ({
    holidays: group,
    key,
    label: monthFormatter.format(
      parseLocalDateTime(`${key}-01`, ENV.VITE_BUSINESS_TIME_ZONE)
    ),
  }));
};

const HolidayTypeBadge = ({ isJointLeave }: { isJointLeave: boolean }) => (
  <span
    className={
      isJointLeave
        ? "inline-flex rounded-full bg-[#fff2d8] px-2.5 py-1 text-xs font-semibold text-[#9a5b00]"
        : "inline-flex rounded-full bg-[#e8f3ff] px-2.5 py-1 text-xs font-semibold text-[#0b63b6]"
    }
  >
    {isJointLeave ? "Cuti bersama" : "Libur nasional"}
  </span>
);

const HolidayList = ({
  holidays,
}: {
  holidays: readonly ScheduleHolidayRecord[];
}) => {
  const monthGroups = useMemo(() => groupHolidaysByMonth(holidays), [holidays]);

  if (!holidays.length) {
    return (
      <State
        description="Tidak ada tanggal libur yang tercatat untuk tahun ini."
        title="Kalender masih kosong"
        variant="not-found"
      />
    );
  }

  return (
    <div className="grid gap-7">
      {monthGroups.map((month) => (
        <section
          aria-labelledby={`calendar-month-${month.key}`}
          key={month.key}
        >
          <h3
            className="mb-3 flex items-center gap-2 text-sm font-semibold capitalize"
            id={`calendar-month-${month.key}`}
          >
            <span className="bg-primary size-2 rounded-full" />
            {month.label}
          </h3>
          <ul className="grid gap-3">
            {month.holidays.map((holiday) => {
              const { day } = getDatePartsInTimeZone(
                parseLocalDateTime(holiday.date, ENV.VITE_BUSINESS_TIME_ZONE),
                ENV.VITE_BUSINESS_TIME_ZONE
              );
              return (
                <li
                  className="bg-background flex items-center gap-3 rounded-xl border p-3 sm:gap-4"
                  key={holiday.date}
                >
                  <div className="bg-muted/60 grid size-12 shrink-0 place-items-center rounded-xl text-center">
                    <span className="text-lg leading-none font-semibold">
                      {day}
                    </span>
                    <span className="text-muted-foreground text-[10px] uppercase">
                      {holiday.date.slice(5, 7)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{holiday.name}</p>
                    <p className="text-muted-foreground text-sm capitalize">
                      {formatHolidayDate(holiday.date)}
                    </p>
                  </div>
                  <HolidayTypeBadge isJointLeave={holiday.isJointLeave} />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
};

const CalendarSummary = ({
  holidays,
  year,
}: {
  holidays: readonly ScheduleHolidayRecord[];
  year: number;
}) => {
  const jointLeaveCount = holidays.filter(
    (holiday) => holiday.isJointLeave
  ).length;
  const nationalHolidayCount = holidays.length - jointLeaveCount;

  return (
    <Card className="overflow-hidden border-0 bg-[#073f63] text-white shadow-lg shadow-[#073f63]/10">
      <CardContent className="relative grid gap-6 p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-cyan-300/15 blur-2xl" />
        <div className="relative flex items-start gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/15">
            <CalendarDays aria-hidden="true" className="size-6" />
          </div>
          <div>
            <p className="text-sm text-cyan-100">Referensi penjadwalan</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              Kalender nasional {year}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-cyan-50/85">
              Gunakan tanggal merah dan cuti bersama ini sebagai acuan sebelum
              menyusun jadwal kelas, ujian, dan kegiatan akademik.
            </p>
          </div>
        </div>
        <div className="relative grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-white/10 p-4">
            <p className="text-xs text-cyan-100">Total tanggal merah</p>
            <p className="mt-1 text-2xl font-semibold">{holidays.length}</p>
          </div>
          <div className="rounded-xl bg-white/10 p-4">
            <p className="text-xs text-cyan-100">Libur nasional</p>
            <p className="mt-1 text-2xl font-semibold">
              {nationalHolidayCount}
            </p>
          </div>
          <div className="rounded-xl bg-white/10 p-4">
            <p className="text-xs text-cyan-100">Cuti bersama</p>
            <p className="mt-1 text-2xl font-semibold">{jointLeaveCount}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const CalendarInfoCard = ({
  holidays,
}: {
  holidays: readonly ScheduleHolidayRecord[];
}) => {
  const usesOfficialFallback = holidays[0]?.source === "OFFICIAL_FALLBACK";
  const sourceUrl =
    holidays[0]?.sourceUrl ?? "https://api.kemendesa.link/libur-nasional/";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info aria-hidden="true" className="text-primary size-5" />
          Tentang kalender ini
        </CardTitle>
        <CardDescription>
          Informasi yang membantu membaca dan menggunakan kalender nasional.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm leading-6">
        <div className="bg-muted/30 flex gap-3 rounded-xl p-4">
          <Sparkles
            aria-hidden="true"
            className="text-primary mt-0.5 size-4 shrink-0"
          />
          <p>
            Jadwal kelas yang bertepatan dengan tanggal merah akan otomatis
            dilewati dan dipindahkan ke minggu berikutnya saat jadwal dibuat.
          </p>
        </div>
        <p className="text-muted-foreground">
          Data mencakup libur nasional dan cuti bersama. Sumber yang digunakan
          untuk tahun ini adalah{" "}
          <span className="text-foreground font-medium">
            {usesOfficialFallback
              ? "fallback resmi SKB pemerintah"
              : "kalender publik"}
          </span>
          {usesOfficialFallback
            ? ". Endpoint publik belum menyediakan data tahun tersebut."
            : ". Data akan mengikuti pembaruan sumber nasional."}
        </p>
        <a
          className="text-primary inline-flex items-center gap-2 font-medium hover:underline"
          href={sourceUrl}
          rel="noreferrer"
          target="_blank"
        >
          Lihat sumber data kalender
          <ExternalLink aria-hidden="true" className="size-4" />
        </a>
      </CardContent>
    </Card>
  );
};

const NationalCalendarPage = () => {
  const [year, setYear] = useState(currentYear);
  const [yearInput, setYearInput] = useState(String(currentYear));
  const holidays = useQuery(
    orpc.scheduling.nationalHolidays.list.queryOptions({ input: { year } })
  );
  const parsedYear = Number(yearInput);
  const yearIsValid =
    Number.isInteger(parsedYear) &&
    parsedYear >= MIN_CALENDAR_YEAR &&
    parsedYear <= MAX_CALENDAR_YEAR;

  const handleYearSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!yearIsValid) {
      return;
    }
    setYear(parsedYear);
  };

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <PageHeader
        action={
          <Button
            disabled={holidays.isFetching}
            onClick={() => holidays.refetch()}
            variant="outline"
          >
            <RefreshCw
              aria-hidden="true"
              className={holidays.isFetching ? "animate-spin" : undefined}
            />
            Perbarui data
          </Button>
        }
        description="Lihat tanggal merah dan cuti bersama sebagai acuan penyusunan jadwal akademik."
        eyebrow="Kelas dan jadwal"
        title="Kalender nasional"
      />

      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-4 p-5">
          <div>
            <p className="font-semibold">Pilih tahun kalender</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Kalender ditampilkan berdasarkan tahun yang dipilih.
            </p>
          </div>
          <form
            className="flex w-full items-end gap-2 sm:w-auto"
            onSubmit={handleYearSubmit}
          >
            <label className="grid gap-1.5" htmlFor="national-calendar-year">
              <span className="text-sm font-medium">Tahun</span>
              <Input
                aria-invalid={!yearIsValid}
                id="national-calendar-year"
                max={MAX_CALENDAR_YEAR}
                min={MIN_CALENDAR_YEAR}
                onChange={(event) => setYearInput(event.target.value)}
                type="number"
                value={yearInput}
              />
            </label>
            <Button
              disabled={!yearIsValid || holidays.isFetching}
              type="submit"
            >
              Tampilkan
            </Button>
          </form>
        </CardContent>
        {yearIsValid ? null : (
          <p className="text-destructive px-5 pb-5 text-sm">
            Masukkan tahun antara {MIN_CALENDAR_YEAR} dan {MAX_CALENDAR_YEAR}.
          </p>
        )}
      </Card>

      {holidays.isPending ? (
        <State
          description={`Kalender nasional ${year} sedang dimuat.`}
          title="Memuat kalender nasional"
          variant="loading"
        />
      ) : null}

      {holidays.isError ? (
        <State
          action={
            <Button onClick={() => holidays.refetch()} variant="outline">
              <RefreshCw aria-hidden="true" /> Coba lagi
            </Button>
          }
          description={
            holidays.error instanceof Error
              ? holidays.error.message
              : `Kalender nasional ${year} belum dapat dimuat.`
          }
          title="Kalender belum tersedia"
          variant="error"
        />
      ) : null}

      {holidays.data ? (
        <>
          <CalendarSummary holidays={holidays.data} year={year} />
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.7fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Daftar hari libur</CardTitle>
                <CardDescription>
                  Urutan tanggal berdasarkan bulan untuk memudahkan pencarian.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <HolidayList holidays={holidays.data} />
              </CardContent>
            </Card>
            <CalendarInfoCard holidays={holidays.data} />
          </div>
        </>
      ) : null}
    </div>
  );
};

export default NationalCalendarPage;
