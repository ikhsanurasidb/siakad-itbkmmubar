import type { RoleKey } from "@siakad-itbkmmubar/api/identity";
import { Button } from "@siakad-itbkmmubar/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@siakad-itbkmmubar/ui/components/card";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Database,
  FileText,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
  UserRound,
  UsersRound,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { roleLabels } from "@/lib/active-role";

interface DashboardMetric {
  description: string;
  icon: LucideIcon;
  label: string;
  value: string;
}

interface DashboardAction {
  description: string;
  icon: LucideIcon;
  label: string;
  to: string;
}

interface DashboardHighlight {
  description: string;
  icon: LucideIcon;
  label: string;
}

interface RoleDashboardConfig {
  description: string;
  eyebrow: string;
  highlights: readonly DashboardHighlight[];
  metrics: readonly DashboardMetric[];
  primaryAction: DashboardAction;
  quickActions: readonly DashboardAction[];
  title: string;
}

interface RoleDashboardPageProps {
  role: RoleKey;
  userName: string;
}

const roleDashboardConfigs: Record<RoleKey, RoleDashboardConfig> = {
  ADMIN_AKADEMIK: {
    description:
      "Pantau operasional akademik, data mahasiswa, dan layanan perkuliahan dari satu ruang kerja.",
    eyebrow: "Pusat operasional akademik",
    highlights: [
      {
        description:
          "Kelola data akademik yang menjadi sumber seluruh layanan.",
        icon: Database,
        label: "Data master teratur",
      },
      {
        description: "Susun kelas, jadwal, KRS, dan publikasi nilai.",
        icon: CalendarDays,
        label: "Siklus akademik terpantau",
      },
      {
        description: "Tinjau aktivitas akademik sesuai kewenangan Anda.",
        icon: ShieldCheck,
        label: "Akses berbasis peran",
      },
    ],
    metrics: [
      {
        description: "Kelas, ruang, dan jadwal",
        icon: CalendarDays,
        label: "Penjadwalan",
        value: "Siap dikelola",
      },
      {
        description: "Paket KRS semester berjalan",
        icon: ClipboardList,
        label: "KRS",
        value: "Terpantau",
      },
      {
        description: "Mahasiswa, dosen, dan referensi",
        icon: UsersRound,
        label: "Data master",
        value: "Terpusat",
      },
    ],
    primaryAction: {
      description: "Buka ringkasan data mahasiswa dan dosen.",
      icon: Database,
      label: "Buka data master",
      to: "/admin-akademik/master-data",
    },
    quickActions: [
      {
        description: "Atur kelas, ruang, dan jadwal kuliah.",
        icon: CalendarDays,
        label: "Kelola kelas dan jadwal",
        to: "/admin-akademik/kelas",
      },
      {
        description: "Siapkan paket KRS untuk mahasiswa.",
        icon: ClipboardList,
        label: "Kelola KRS",
        to: "/admin-akademik/krs",
      },
      {
        description: "Tinjau akun dan assignment akademik.",
        icon: UserRound,
        label: "Kelola akun akademik",
        to: "/admin-akademik/identitas/akun",
      },
    ],
    title: "Kendalikan operasional akademik",
  },
  ADMIN_KEUANGAN: {
    description:
      "Ruang kerja untuk menyiapkan layanan keuangan akademik dengan akses yang terpisah dan aman.",
    eyebrow: "Pusat layanan keuangan",
    highlights: [
      {
        description: "Role keuangan dipisahkan dari operasional akademik.",
        icon: ShieldCheck,
        label: "Segregasi akses aktif",
      },
      {
        description:
          "Modul transaksi keuangan akan hadir pada tahap berikutnya.",
        icon: WalletCards,
        label: "Modul dalam persiapan",
      },
      {
        description: "Keamanan akun tetap tersedia dari ruang kerja ini.",
        icon: KeyRound,
        label: "Akun terlindungi",
      },
    ],
    metrics: [
      {
        description: "Status akun dan role",
        icon: CheckCircle2,
        label: "Akses",
        value: "Aktif",
      },
      {
        description: "Layanan keuangan",
        icon: WalletCards,
        label: "Modul",
        value: "Segera hadir",
      },
      {
        description: "Bantuan operasional",
        icon: UsersRound,
        label: "Dukungan",
        value: "Admin Akademik",
      },
    ],
    primaryAction: {
      description: "Periksa dan perbarui keamanan akun Anda.",
      icon: KeyRound,
      label: "Buka keamanan akun",
      to: "/akun/keamanan",
    },
    quickActions: [
      {
        description: "Kelola kata sandi dan sesi perangkat.",
        icon: KeyRound,
        label: "Keamanan akun",
        to: "/akun/keamanan",
      },
    ],
    title: "Siapkan layanan keuangan akademik",
  },
  DOSEN: {
    description:
      "Kelola jadwal mengajar, ruang pembelajaran, presensi, dan nilai kelas Anda.",
    eyebrow: "Ruang kerja dosen",
    highlights: [
      {
        description: "Lihat agenda mengajar dan detail pertemuan.",
        icon: CalendarDays,
        label: "Agenda mengajar",
      },
      {
        description: "Bagikan materi dan kelola aktivitas pembelajaran.",
        icon: BookOpen,
        label: "Pembelajaran terhubung",
      },
      {
        description: "Catat presensi dan susun nilai kelas.",
        icon: ClipboardCheck,
        label: "Administrasi kelas",
      },
    ],
    metrics: [
      {
        description: "Pertemuan dan agenda hari ini",
        icon: CalendarDays,
        label: "Jadwal mengajar",
        value: "Lihat agenda",
      },
      {
        description: "Materi, forum, dan tugas",
        icon: BookOpen,
        label: "Ruang pembelajaran",
        value: "Siap dibuka",
      },
      {
        description: "Presensi dan nilai mahasiswa",
        icon: GraduationCap,
        label: "Penilaian",
        value: "Kelola kelas",
      },
    ],
    primaryAction: {
      description: "Lihat agenda mengajar dan kelas yang Anda ampu.",
      icon: CalendarDays,
      label: "Buka jadwal mengajar",
      to: "/dosen/jadwal",
    },
    quickActions: [
      {
        description: "Buka materi, forum, dan tugas kelas.",
        icon: BookOpen,
        label: "Ruang pembelajaran",
        to: "/dosen/lms",
      },
      {
        description: "Catat dan tinjau presensi pertemuan.",
        icon: Camera,
        label: "Presensi kelas",
        to: "/dosen/presensi",
      },
      {
        description: "Kelola nilai untuk kelas yang diampu.",
        icon: GraduationCap,
        label: "Nilai kelas",
        to: "/dosen/nilai",
      },
    ],
    title: "Siapkan perkuliahan hari ini",
  },
  KAPRODI: {
    description:
      "Pantau mutu dan kesiapan akademik program studi, dari kurikulum hingga jadwal kuliah.",
    eyebrow: "Pusat kendali program studi",
    highlights: [
      {
        description: "Lihat kelas dan jadwal kuliah program studi.",
        icon: CalendarDays,
        label: "Jadwal kuliah",
      },
      {
        description: "Pastikan struktur kurikulum tetap relevan dan lengkap.",
        icon: BookOpen,
        label: "Kurikulum terkawal",
      },
      {
        description: "Pantau KRS, nilai, dan presensi mahasiswa.",
        icon: GraduationCap,
        label: "Progres mahasiswa terlihat",
      },
    ],
    metrics: [
      {
        description: "Kelas kuliah dan jadwal program studi",
        icon: CalendarDays,
        label: "Kelas dan jadwal",
        value: "Lihat sekarang",
      },
      {
        description: "Kurikulum dan komponen penilaian",
        icon: BookOpen,
        label: "Kurikulum",
        value: "Terpantau",
      },
      {
        description: "KRS dan hasil studi mahasiswa",
        icon: GraduationCap,
        label: "Akademik prodi",
        value: "Lihat ringkasan",
      },
    ],
    primaryAction: {
      description: "Lihat kelas kuliah dan jadwal program studi.",
      icon: CalendarDays,
      label: "Buka kelas dan jadwal",
      to: "/kaprodi/jadwal/persetujuan",
    },
    quickActions: [
      {
        description: "Tinjau struktur dan mata kuliah prodi.",
        icon: BookOpen,
        label: "Kurikulum prodi",
        to: "/kaprodi/kurikulum",
      },
      {
        description: "Pantau KRS mahasiswa program studi.",
        icon: ClipboardList,
        label: "KRS mahasiswa",
        to: "/kaprodi/krs",
      },
      {
        description: "Tinjau nilai dan presensi program studi.",
        icon: GraduationCap,
        label: "Nilai prodi",
        to: "/kaprodi/nilai",
      },
    ],
    title: "Jaga mutu program studi",
  },
  MAHASISWA: {
    description:
      "Temukan jadwal kuliah, kelola KRS, ikuti pembelajaran, dan pantau hasil studi Anda.",
    eyebrow: "Ruang akademik mahasiswa",
    highlights: [
      {
        description: "Pastikan agenda kuliah dan ruang kelas selalu terbaru.",
        icon: CalendarDays,
        label: "Jadwal kuliah",
      },
      {
        description: "Akses materi, forum, dan tugas dalam satu tempat.",
        icon: BookOpen,
        label: "Belajar lebih teratur",
      },
      {
        description: "Pantau nilai, KHS, dan perjalanan akademik.",
        icon: GraduationCap,
        label: "Hasil studi tersimpan",
      },
    ],
    metrics: [
      {
        description: "Jadwal perkuliahan semester berjalan",
        icon: CalendarDays,
        label: "Jadwal kuliah",
        value: "Lihat jadwal",
      },
      {
        description: "KRS dan status pengambilan mata kuliah",
        icon: ClipboardList,
        label: "KRS semester ini",
        value: "Periksa KRS",
      },
      {
        description: "Nilai, KHS, dan transkrip akademik",
        icon: GraduationCap,
        label: "Hasil studi",
        value: "Lihat hasil",
      },
    ],
    primaryAction: {
      description: "Lihat agenda perkuliahan semester berjalan.",
      icon: CalendarDays,
      label: "Buka jadwal kuliah",
      to: "/mahasiswa/jadwal",
    },
    quickActions: [
      {
        description: "Periksa dan kelola KRS semester ini.",
        icon: ClipboardList,
        label: "KRS semester ini",
        to: "/mahasiswa/krs",
      },
      {
        description: "Masuk ke kelas, materi, dan tugas.",
        icon: BookOpen,
        label: "Ruang pembelajaran",
        to: "/mahasiswa/lms",
      },
      {
        description: "Lihat nilai dan riwayat hasil studi.",
        icon: GraduationCap,
        label: "Nilai dan KHS",
        to: "/mahasiswa/nilai",
      },
    ],
    title: "Atur langkah akademik Anda",
  },
  SUPERADMIN: {
    description:
      "Pantau fondasi platform, kelola akses, dan pastikan seluruh layanan SIAKAD tetap siap digunakan.",
    eyebrow: "Pusat kendali platform",
    highlights: [
      {
        description: "Kelola identitas, role, dan scope akses pengguna.",
        icon: ShieldCheck,
        label: "Akses terkendali",
      },
      {
        description: "Jaga konsistensi data referensi seluruh sistem.",
        icon: Database,
        label: "Data platform terpusat",
      },
      {
        description: "Atur kebijakan keamanan dan operasional aplikasi.",
        icon: Settings2,
        label: "Kebijakan terkelola",
      },
    ],
    metrics: [
      {
        description: "Identitas dan role pengguna",
        icon: UsersRound,
        label: "Identitas & akses",
        value: "Kelola akses",
      },
      {
        description: "Referensi akademik dan operasional",
        icon: Database,
        label: "Data master",
        value: "Terpusat",
      },
      {
        description: "Kebijakan layanan dan keamanan",
        icon: Settings2,
        label: "Pengaturan sistem",
        value: "Siap ditinjau",
      },
    ],
    primaryAction: {
      description: "Kelola akun dan akses pengguna sistem.",
      icon: ShieldCheck,
      label: "Kelola identitas dan akses",
      to: "/superadmin/identitas/akun",
    },
    quickActions: [
      {
        description: "Periksa dan kelola data referensi sistem.",
        icon: Database,
        label: "Data master",
        to: "/superadmin/master-data",
      },
      {
        description: "Tinjau kebijakan keamanan dan operasional.",
        icon: Settings2,
        label: "Pengaturan sistem",
        to: "/superadmin/pengaturan",
      },
      {
        description: "Buka jadwal, kelas, dan proses akademik.",
        icon: CalendarDays,
        label: "Kelas dan jadwal",
        to: "/superadmin/kelas",
      },
    ],
    title: "Pastikan platform selalu siap",
  },
};

const RoleDashboardPage = ({ role, userName }: RoleDashboardPageProps) => {
  const config = roleDashboardConfigs[role];
  const firstName = userName.trim().split(/\s+/u)[0] || "Pengguna";

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:gap-8 lg:p-8">
      <section className="relative overflow-hidden rounded-3xl bg-[#12395c] px-6 py-7 text-white shadow-[0_24px_60px_-32px_rgba(18,57,92,0.7)] sm:px-8 sm:py-9">
        <div className="absolute -top-28 -right-24 size-72 rounded-full bg-[#e6bb4d]/20 blur-2xl" />
        <div className="absolute -bottom-36 left-1/3 size-72 rounded-full bg-[#1d78d4]/30 blur-3xl" />
        <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="grid max-w-3xl gap-4">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-[#b8cee1] uppercase">
              <LayoutDashboard aria-hidden="true" className="size-4" />
              <span>{config.eyebrow}</span>
            </div>
            <div className="grid gap-2">
              <p className="text-sm text-[#d9e6f1]">
                Selamat datang, {firstName}.
              </p>
              <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
                {config.title}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-[#d9e6f1] sm:text-base">
                {config.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm backdrop-blur-sm">
            <span className="grid size-10 place-items-center rounded-xl bg-[#e6bb4d] font-bold text-[#12395c]">
              {roleLabels[role].slice(0, 1)}
            </span>
            <div className="grid gap-0.5">
              <span className="text-xs text-[#b8cee1]">Peran aktif</span>
              <span className="font-semibold">{roleLabels[role]}</span>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="dashboard-summary" className="grid gap-4">
        <div className="flex items-end justify-between gap-4">
          <div className="grid gap-1">
            <h2
              className="text-lg font-semibold tracking-tight"
              id="dashboard-summary"
            >
              Ringkasan ruang kerja
            </h2>
            <p className="text-muted-foreground text-sm">
              Akses utama yang paling relevan dengan peran Anda.
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {config.metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <Card className="border-[#dbe5ee] shadow-none" key={metric.label}>
                <CardContent className="grid gap-5 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-[#e8eff6] text-[#12395c]">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <span className="rounded-full bg-[#edf8f1] px-2.5 py-1 text-[11px] font-semibold text-[#19703a]">
                      Aktif
                    </span>
                  </div>
                  <div className="grid gap-1">
                    <p className="text-muted-foreground text-xs font-medium uppercase">
                      {metric.label}
                    </p>
                    <p className="text-xl font-semibold tracking-tight text-[#12395c]">
                      {metric.value}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {metric.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <Card className="border-[#dbe5ee] shadow-none">
          <CardHeader className="border-b border-[#e7edf3] pb-5">
            <CardTitle className="text-[#12395c]">Aksi cepat</CardTitle>
            <CardDescription>
              Mulai pekerjaan dari layanan yang paling sering digunakan.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
            {config.quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  className="group flex items-start gap-4 rounded-2xl border border-[#dbe5ee] p-4 transition-colors hover:border-[#9ab8d0] hover:bg-[#f7fafc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d78d4]"
                  key={action.label}
                  to={action.to}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f0f5f9] text-[#1d78d4] transition-colors group-hover:bg-[#e2edf6]">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="grid min-w-0 gap-1">
                    <span className="font-semibold text-[#12395c]">
                      {action.label}
                    </span>
                    <span className="text-muted-foreground text-sm leading-5">
                      {action.description}
                    </span>
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="mt-1 ml-auto size-4 shrink-0 text-[#9aabba] transition-transform group-hover:translate-x-0.5 group-hover:text-[#1d78d4]"
                  />
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-[#dbe5ee] bg-[#f8fafc] shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-[#12395c]">Fokus peran</CardTitle>
            <CardDescription>
              Hal yang dapat Anda kerjakan dari dashboard ini.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {config.highlights.map((highlight) => {
              const Icon = highlight.icon;
              return (
                <div className="flex gap-3" key={highlight.label}>
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-[#1d78d4] shadow-sm ring-1 ring-[#dbe5ee]">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <div className="grid gap-0.5">
                    <p className="text-sm font-semibold text-[#12395c]">
                      {highlight.label}
                    </p>
                    <p className="text-muted-foreground text-sm leading-5">
                      {highlight.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <Card className="overflow-hidden border-[#dbe5ee] bg-[#fffaf0] shadow-none">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff0c7] text-[#a87908]">
              <FileText aria-hidden="true" className="size-5" />
            </span>
            <div className="grid gap-1">
              <p className="font-semibold text-[#6e5312]">Butuh bantuan?</p>
              <p className="text-sm leading-5 text-[#806a32]">
                Gunakan menu di sebelah kiri untuk membuka layanan lain sesuai
                akses {roleLabels[role].toLowerCase()} Anda.
              </p>
            </div>
          </div>
          <Button
            className="w-full border-[#d8c27b] bg-white text-[#6e5312] hover:bg-[#fff4d7] sm:w-auto"
            render={<Link to={config.primaryAction.to} />}
            variant="outline"
          >
            {config.primaryAction.label}
            <ArrowRight aria-hidden="true" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default RoleDashboardPage;
