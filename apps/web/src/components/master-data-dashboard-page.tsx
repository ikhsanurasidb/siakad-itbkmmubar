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
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Database,
  FileSpreadsheet,
  GraduationCap,
  Laptop,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Upload,
  UsersRound,
} from "lucide-react";

import { orpc } from "@/utils/orpc";

type MasterDataBasePath =
  | "/admin-akademik/master-data"
  | "/superadmin/master-data";

interface MasterDataDashboardPageProps {
  basePath: MasterDataBasePath;
  roleName: string;
}

const entityCards = [
  {
    description: "Kode, nama, dan jenjang pendidikan.",
    entityType: "STUDY_PROGRAM",
    icon: GraduationCap,
    label: "Program studi",
    slug: "prodi",
  },
  {
    description: "Tahun masuk yang terhubung ke Prodi.",
    entityType: "COHORT",
    icon: CalendarDays,
    label: "Angkatan",
    slug: "angkatan",
  },
  {
    description: "NIM, status akademik, dan penerbitan akun.",
    entityType: "STUDENT",
    icon: UsersRound,
    label: "Mahasiswa",
    slug: "mahasiswa",
  },
  {
    description: "NIDN, NUPTK, dan penerbitan akun.",
    entityType: "LECTURER",
    icon: UsersRound,
    label: "Dosen",
    slug: "dosen",
  },
  {
    description: "Kode, kapasitas, dan koordinat ruang.",
    entityType: "ROOM",
    icon: MapPin,
    label: "Ruang",
    slug: "ruang",
  },
  {
    description: "SKS, semester awal, dan Prodi pemilik.",
    entityType: "COURSE",
    icon: BookOpen,
    label: "Mata kuliah",
    slug: "mata-kuliah",
  },
  {
    description: "Tahun akademik, term, dan rentang tanggal.",
    entityType: "ACADEMIC_PERIOD",
    icon: ClipboardList,
    label: "Periode akademik",
    slug: "semester",
  },
] as const;

const entityLabels: Record<string, string> = {
  ACADEMIC_PERIOD: "Periode akademik",
  ACADEMIC_YEAR: "Tahun akademik",
  COHORT: "Angkatan",
  COURSE: "Mata kuliah",
  LECTURER: "Dosen",
  ROOM: "Ruang",
  STUDENT: "Mahasiswa",
  STUDY_PROGRAM: "Program studi",
};

const importStatusLabels: Record<string, string> = {
  COMMITTING: "Sedang diproses",
  COMPLETED: "Selesai",
  FAILED: "Gagal",
  PARTIAL_FAILED: "Sebagian gagal",
  READY: "Siap dikonfirmasi",
  UPLOADED: "Terunggah",
  VALIDATING: "Sedang divalidasi",
};

const formatNumber = new Intl.NumberFormat("id-ID");
const formatDate = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const getStatusClassName = (status: string): string => {
  if (status === "COMPLETED") {
    return "bg-[#e7f7ef] text-[#137a4b]";
  }
  if (["FAILED", "PARTIAL_FAILED", "READY"].includes(status)) {
    return "bg-[#fff2df] text-[#9a5a00]";
  }
  return "bg-[#eaf3ff] text-[#0b63b6]";
};

const getDateLabel = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Tanggal tidak tersedia"
    : formatDate.format(date);
};

const MasterDataDashboardPage = ({
  basePath,
  roleName,
}: MasterDataDashboardPageProps) => {
  const summary = useQuery(orpc.masterData.summary.queryOptions());

  if (summary.isPending) {
    return (
      <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
        <PageHeader
          description="Memuat ringkasan data resmi dan aktivitas impor."
          eyebrow="Data master"
          title="Pusat data master"
        />
        <State
          description="Kami sedang mengambil statistik terbaru dari database."
          title="Memuat ringkasan"
          variant="loading"
        />
      </div>
    );
  }

  if (summary.isError || !summary.data) {
    return (
      <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
        <PageHeader
          description="Ringkasan data resmi dan aktivitas impor."
          eyebrow="Data master"
          title="Pusat data master"
        />
        <State
          action={
            <Button onClick={() => summary.refetch()} variant="outline">
              <RefreshCw aria-hidden="true" />
              Coba lagi
            </Button>
          }
          description="Ringkasan belum dapat dimuat. Periksa koneksi atau coba lagi."
          title="Ringkasan tidak tersedia"
          variant="error"
        />
      </div>
    );
  }

  const { data } = summary;
  const countsByEntity = new Map(
    data.entities.map((entity) => [entity.entityType, entity])
  );
  const periodCounts = countsByEntity.get("ACADEMIC_PERIOD");
  const yearCounts = countsByEntity.get("ACADEMIC_YEAR");
  const { attentionCount } = data.imports;
  const [latestImport] = data.imports.recent;

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <PageHeader
        action={
          <div className="flex flex-wrap gap-2">
            <Link to={`${basePath}/import`}>
              <Button size="sm" variant="outline">
                <Upload aria-hidden="true" />
                Impor massal
              </Button>
            </Link>
            <Link to={`${basePath}/prodi`}>
              <Button size="sm">
                <GraduationCap aria-hidden="true" />
                Tambah Prodi
              </Button>
            </Link>
          </div>
        }
        description="Satu sumber data resmi untuk identitas akademik dan referensi operasional."
        eyebrow={`Data master · ${roleName}`}
        title="Pusat data master"
      />

      <section className="relative overflow-hidden rounded-3xl bg-[#12395c] px-6 py-7 text-white shadow-[0_18px_45px_rgba(18,57,92,0.18)] sm:px-8">
        <div className="relative z-10 grid gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="grid max-w-2xl gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-[#b9d9f4] uppercase">
              <ShieldCheck aria-hidden="true" className="size-4" />
              Data siap digunakan
            </div>
            <h2 className="max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
              Jaga kualitas data dari satu pusat kendali.
            </h2>
            <p className="max-w-xl text-sm leading-6 text-[#d4e5f2]">
              Kelola referensi Prodi, angkatan, identitas akademik, ruang, mata
              kuliah, dan periode dengan validasi yang konsisten.
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-xs font-medium text-[#e7f3fb]">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">
                Referensi aktif terjaga
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">
                Pengarsipan tanpa menghapus data
              </span>
            </div>
          </div>
          <div className="hidden size-32 items-center justify-center rounded-full border border-white/15 bg-white/10 lg:flex">
            <Database aria-hidden="true" className="size-14 text-[#d9a83f]" />
          </div>
        </div>
        <div className="absolute -right-16 -bottom-28 size-64 rounded-full border border-white/10" />
        <div className="absolute -right-2 -bottom-16 size-36 rounded-full border border-[#d9a83f]/30" />
      </section>

      <section
        aria-label="Ringkasan data"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <div className="rounded-2xl border border-[#dbe5ee] bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-1">
              <p className="text-xs font-medium text-[#71859c]">Total data</p>
              <p className="text-3xl font-semibold tracking-tight text-[#102d4d]">
                {formatNumber.format(data.totals.totalCount)}
              </p>
            </div>
            <span className="grid size-10 place-items-center rounded-xl bg-[#eaf3ff] text-[#0b63b6]">
              <Database aria-hidden="true" className="size-5" />
            </span>
          </div>
          <p className="mt-4 text-xs text-[#71859c]">
            Di seluruh entitas master
          </p>
        </div>
        <div className="rounded-2xl border border-[#dbe5ee] bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-1">
              <p className="text-xs font-medium text-[#71859c]">Data aktif</p>
              <p className="text-3xl font-semibold tracking-tight text-[#137a4b]">
                {formatNumber.format(data.totals.activeCount)}
              </p>
            </div>
            <span className="grid size-10 place-items-center rounded-xl bg-[#e7f7ef] text-[#137a4b]">
              <CheckCircle2 aria-hidden="true" className="size-5" />
            </span>
          </div>
          <p className="mt-4 text-xs text-[#71859c]">
            Siap dipakai pada transaksi
          </p>
        </div>
        <div className="rounded-2xl border border-[#dbe5ee] bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-1">
              <p className="text-xs font-medium text-[#71859c]">Diarsipkan</p>
              <p className="text-3xl font-semibold tracking-tight text-[#536b83]">
                {formatNumber.format(data.totals.archivedCount)}
              </p>
            </div>
            <span className="grid size-10 place-items-center rounded-xl bg-[#f0f3f6] text-[#536b83]">
              <ClipboardList aria-hidden="true" className="size-5" />
            </span>
          </div>
          <p className="mt-4 text-xs text-[#71859c]">
            Tetap tersimpan untuk histori
          </p>
        </div>
        <div className="rounded-2xl border border-[#f0d9b2] bg-[#fffaf2] p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-1">
              <p className="text-xs font-medium text-[#8a6a38]">
                Perlu ditinjau
              </p>
              <p className="text-3xl font-semibold tracking-tight text-[#9a5a00]">
                {formatNumber.format(attentionCount)}
              </p>
            </div>
            <span className="grid size-10 place-items-center rounded-xl bg-[#fff0d7] text-[#9a5a00]">
              <FileSpreadsheet aria-hidden="true" className="size-5" />
            </span>
          </div>
          <p className="mt-4 text-xs text-[#8a6a38]">
            Impor siap dikonfirmasi atau gagal
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="border-[#dbe5ee] shadow-none">
          <CardHeader className="border-b border-[#edf2f6] pb-5">
            <CardTitle className="text-[#102d4d]">
              Entitas data master
            </CardTitle>
            <CardDescription>
              Pilih entitas untuk melihat daftar, mencari, atau mengarsipkan
              data.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 pt-4">
            {entityCards.map((entity) => {
              const Icon = entity.icon;
              const counts = countsByEntity.get(entity.entityType);
              const isPeriodCard = entity.entityType === "ACADEMIC_PERIOD";
              const totalCount = isPeriodCard
                ? (periodCounts?.totalCount ?? 0) +
                  (yearCounts?.totalCount ?? 0)
                : (counts?.totalCount ?? 0);
              const activeCount = isPeriodCard
                ? (periodCounts?.activeCount ?? 0) +
                  (yearCounts?.activeCount ?? 0)
                : (counts?.activeCount ?? 0);
              return (
                <Link
                  className="group flex items-center gap-4 rounded-2xl border border-transparent p-3 transition-colors hover:border-[#dbe5ee] hover:bg-[#f8fafc]"
                  key={entity.entityType}
                  to={`${basePath}/${entity.slug}`}
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#eaf3ff] text-[#0b63b6] transition-colors group-hover:bg-[#dceeff]">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold text-[#102d4d]">
                        {entity.label}
                      </span>
                      <span className="text-xs text-[#71859c]">
                        {formatNumber.format(activeCount)} aktif
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-xs text-[#71859c]">
                      {entity.description}
                    </span>
                  </span>
                  <span className="hidden shrink-0 text-right sm:block">
                    <span className="block text-sm font-semibold text-[#102d4d]">
                      {formatNumber.format(totalCount)}
                    </span>
                    <span className="text-[11px] text-[#71859c]">total</span>
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-[#9aabba] transition-transform group-hover:translate-x-0.5 group-hover:text-[#0b63b6]"
                  />
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-[#dbe5ee] shadow-none">
          <CardHeader className="border-b border-[#edf2f6] pb-5">
            <div className="flex items-start justify-between gap-3">
              <div className="grid gap-1">
                <CardTitle className="text-[#102d4d]">Impor massal</CardTitle>
                <CardDescription>Validasi dan simpan bertahap.</CardDescription>
              </div>
              <FileSpreadsheet
                aria-hidden="true"
                className="size-5 text-[#0b63b6]"
              />
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 pt-5">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-[#f8fafc] p-3">
                <p className="text-lg font-semibold text-[#102d4d]">
                  {formatNumber.format(data.imports.completedCount)}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-[#71859c]">
                  Selesai
                </p>
              </div>
              <div className="rounded-xl bg-[#f8fafc] p-3">
                <p className="text-lg font-semibold text-[#0b63b6]">
                  {formatNumber.format(data.imports.inProgressCount)}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-[#71859c]">
                  Berjalan
                </p>
              </div>
              <div className="rounded-xl bg-[#fffaf2] p-3">
                <p className="text-lg font-semibold text-[#9a5a00]">
                  {formatNumber.format(attentionCount)}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-[#8a6a38]">
                  Perhatian
                </p>
              </div>
            </div>
            {latestImport ? (
              <div className="grid gap-3 rounded-2xl border border-[#edf2f6] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#71859c]">
                      Impor terakhir
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-[#102d4d]">
                      {latestImport.filename}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${getStatusClassName(latestImport.status)}`}
                  >
                    {importStatusLabels[latestImport.status] ??
                      latestImport.status}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs text-[#71859c]">
                  <span>
                    {entityLabels[latestImport.entityType] ??
                      latestImport.entityType}
                  </span>
                  <span>{getDateLabel(latestImport.createdAt)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-[#edf2f6] pt-3 text-xs">
                  <span>
                    <strong className="block text-[#102d4d]">
                      {formatNumber.format(latestImport.totalRows)}
                    </strong>
                    <span className="text-[#71859c]">baris</span>
                  </span>
                  <span>
                    <strong className="block text-[#137a4b]">
                      {formatNumber.format(latestImport.validCount)}
                    </strong>
                    <span className="text-[#71859c]">lolos validasi</span>
                  </span>
                  <span>
                    <strong className="block text-[#9a5a00]">
                      {formatNumber.format(
                        latestImport.warningCount + latestImport.invalidCount
                      )}
                    </strong>
                    <span className="text-[#71859c]">perlu ditinjau</span>
                  </span>
                </div>
              </div>
            ) : (
              <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-[#dbe5ee] p-6 text-center">
                <Laptop aria-hidden="true" className="size-6 text-[#9aabba]" />
                <p className="text-sm font-medium text-[#102d4d]">
                  Belum ada riwayat impor
                </p>
                <p className="text-xs text-[#71859c]">
                  Mulai dari templat resmi agar data tervalidasi.
                </p>
              </div>
            )}
            <Link to={`${basePath}/import`}>
              <Button className="w-full" variant="outline">
                Kelola impor massal
                <ArrowRight aria-hidden="true" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#dbe5ee] bg-[#f8fafc] shadow-none">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:p-6">
          <span className="grid size-11 place-items-center rounded-xl bg-white text-[#0b63b6] shadow-sm ring-1 ring-[#dbe5ee]">
            <ShieldCheck aria-hidden="true" className="size-5" />
          </span>
          <div className="grid gap-1">
            <p className="text-sm font-semibold text-[#102d4d]">
              Jaga urutan referensi
            </p>
            <p className="text-xs leading-5 text-[#71859c]">
              Pastikan Prodi aktif sebelum membuat Angkatan atau Mahasiswa. Data
              yang diarsipkan tetap tersedia untuk histori dan tidak dapat
              dipakai sebagai referensi baru.
            </p>
          </div>
          <Link to={`${basePath}/prodi`}>
            <Button size="sm" variant="ghost">
              Cek Prodi
              <ArrowRight aria-hidden="true" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      <p className="text-right text-xs text-[#9aabba]">
        Diperbarui {getDateLabel(data.generatedAt)}
      </p>
    </div>
  );
};

export default MasterDataDashboardPage;
