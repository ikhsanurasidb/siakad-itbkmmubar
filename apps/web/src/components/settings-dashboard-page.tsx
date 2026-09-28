import { settingCategoryLabels } from "@siakad-itbkmmubar/api/settings";
import type { SettingCategory } from "@siakad-itbkmmubar/api/settings";
import { Button } from "@siakad-itbkmmubar/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@siakad-itbkmmubar/ui/components/card";
import { PageHeader } from "@siakad-itbkmmubar/ui/components/page-header";
import { State } from "@siakad-itbkmmubar/ui/components/state";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Database,
  FileSliders,
  GraduationCap,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { orpc } from "@/utils/orpc";

interface SettingsDashboardPageProps {
  roleName: string;
}

const moduleCards = [
  {
    category: "SECURITY",
    description:
      "Batas waktu sesi, kata sandi, dan pembatasan percobaan masuk.",
    icon: ShieldCheck,
    to: "/superadmin/pengaturan/keamanan",
  },
  {
    category: "SCHEDULING",
    description: "Batas waktu perubahan jadwal dan kapasitas rapat daring.",
    icon: CalendarDays,
    to: "/superadmin/pengaturan/penjadwalan",
  },
  {
    category: "ATTENDANCE",
    description: "Radius lokasi serta jendela waktu presensi.",
    icon: ClipboardList,
    to: "/superadmin/pengaturan/presensi",
  },
  {
    category: "GRADING",
    description: "Kebijakan nilai, pembulatan, dan skala nilai.",
    icon: GraduationCap,
    to: "/superadmin/pengaturan/nilai",
  },
  {
    category: "FILE",
    description: "Ukuran maksimum dan jenis berkas yang diizinkan.",
    icon: FileSliders,
    to: "/superadmin/pengaturan/file",
  },
  {
    category: "BATCH",
    description: "Batas baris dan ukuran kelompok untuk proses impor.",
    icon: Database,
    to: "/superadmin/pengaturan/database-job",
  },
] as const satisfies readonly {
  category: SettingCategory;
  description: string;
  icon: LucideIcon;
  to: string;
}[];

const SettingsDashboardPage = ({ roleName }: SettingsDashboardPageProps) => {
  const catalog = useQuery(
    orpc.settings.catalog.queryOptions({
      input: { scopeId: "", scopeType: "SYSTEM" },
    })
  );

  if (catalog.isPending) {
    return (
      <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
        <PageHeader
          description="Ringkasan kebijakan sistem dan konfigurasi operasional."
          eyebrow={`Pengaturan · ${roleName}`}
          title="Pengaturan sistem"
        />
        <State
          description="Konfigurasi terbaru sedang dimuat dari basis data."
          title="Memuat pengaturan"
          variant="loading"
        />
      </div>
    );
  }

  if (catalog.isError || !catalog.data) {
    return (
      <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
        <PageHeader
          description="Ringkasan kebijakan sistem dan konfigurasi operasional."
          eyebrow={`Pengaturan · ${roleName}`}
          title="Pengaturan sistem"
        />
        <State
          action={
            <Button onClick={() => catalog.refetch()} variant="outline">
              <RefreshCw aria-hidden="true" />
              Coba lagi
            </Button>
          }
          description="Konfigurasi belum dapat dimuat. Periksa koneksi atau coba lagi."
          title="Pengaturan tidak tersedia"
          variant="error"
        />
      </div>
    );
  }

  const settingCountByCategory = new Map<SettingCategory, number>();
  for (const item of catalog.data.items) {
    settingCountByCategory.set(
      item.category,
      (settingCountByCategory.get(item.category) ?? 0) + 1
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <PageHeader
        description="Atur kebijakan yang berlaku untuk seluruh pengguna dan proses akademik."
        eyebrow={`Pengaturan sistem · ${roleName}`}
        title="Pengaturan sistem"
      />

      <section className="relative overflow-hidden rounded-3xl bg-[#12395c] px-6 py-7 text-white shadow-[0_18px_45px_rgba(18,57,92,0.18)] sm:px-8">
        <div className="relative z-10 grid gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="grid max-w-2xl gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-[#b9d9f4] uppercase">
              <SlidersHorizontal aria-hidden="true" className="size-4" />
              Kebijakan terpusat
            </div>
            <h2 className="max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
              Atur kebijakan dari satu pusat kendali.
            </h2>
            <p className="max-w-xl text-sm leading-6 text-[#d4e5f2]">
              Pilih modul untuk meninjau nilai yang berlaku, riwayat versi, dan
              mempublikasikan perubahan kebijakan.
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-xs font-medium text-[#e7f3fb]">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">
                {catalog.data.items.length} pengaturan tersedia
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">
                Perubahan tercatat per versi
              </span>
            </div>
          </div>
          <div className="hidden size-32 items-center justify-center rounded-full border border-white/15 bg-white/10 lg:flex">
            <SlidersHorizontal
              aria-hidden="true"
              className="size-14 text-[#d9a83f]"
            />
          </div>
        </div>
        <div className="absolute -right-16 -bottom-28 size-64 rounded-full border border-white/10" />
        <div className="absolute -right-2 -bottom-16 size-36 rounded-full border border-[#d9a83f]/30" />
      </section>

      <section
        aria-label="Modul pengaturan"
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {moduleCards.map((module) => {
          const settingCount = settingCountByCategory.get(module.category) ?? 0;

          return (
            <Card
              className="group border-[#dbe5ee] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9fc3df] hover:shadow-md"
              key={module.category}
            >
              <CardHeader className="gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="grid size-11 place-items-center rounded-2xl bg-[#eaf3ff] text-[#0b63b6]">
                    <module.icon aria-hidden="true" className="size-5" />
                  </div>
                  <span className="rounded-full bg-[#e7f7ef] px-2.5 py-1 text-xs font-semibold text-[#137a4b]">
                    <CheckCircle2
                      aria-hidden="true"
                      className="mr-1 inline size-3.5"
                    />
                    Tersedia
                  </span>
                </div>
                <div className="grid gap-1">
                  <CardTitle>
                    {settingCategoryLabels[module.category]}
                  </CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <p className="text-sm text-[#71859c]">
                  {settingCount} pengaturan tersedia
                </p>
                <Link
                  aria-label={`Buka pengaturan ${settingCategoryLabels[module.category]}`}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-[#0b63b6] transition group-hover:gap-2"
                  to={module.to}
                >
                  Kelola {settingCategoryLabels[module.category].toLowerCase()}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
};

export default SettingsDashboardPage;
