import {
  CalendarDays,
  FileText,
  GraduationCap,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";

const highlights = [
  { icon: GraduationCap, label: "KRS" },
  { icon: CalendarDays, label: "Jadwal Kuliah" },
  { icon: UsersRound, label: "Presensi" },
  { icon: FileText, label: "Nilai dan Transkrip" },
] as const;

interface PublicAuthLayoutProps {
  children: ReactNode;
}

const Brand = ({ dark = false }: { dark?: boolean }) => (
  <div className="flex items-center gap-3">
    <img
      alt="Logo ITBKM"
      className={`size-12 shrink-0 rounded-xl object-cover ${dark ? "shadow-lg shadow-slate-950/15" : ""}`}
      src="/logo-itbkm.webp"
    />
    <span
      className={
        dark
          ? "text-base font-bold tracking-wide text-white"
          : "text-base font-bold tracking-wide text-[#12395c]"
      }
    >
      SIAKAD ITBKM MUNA BARAT
    </span>
  </div>
);

const PublicAuthLayout = ({ children }: PublicAuthLayoutProps) => (
  <div className="min-h-svh bg-[#f6f9fc] lg:grid lg:grid-cols-[minmax(30rem,44%)_1fr]">
    <section className="relative hidden min-h-svh overflow-hidden bg-[#12395c] px-12 py-12 text-white lg:flex lg:flex-col xl:px-20">
      <div className="pointer-events-none absolute -top-36 -right-32 size-[32rem] rounded-full border border-white/10" />
      <div className="pointer-events-none absolute top-32 -right-48 size-[38rem] rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -bottom-56 -left-32 size-[32rem] rounded-full border border-white/10" />
      <div className="pointer-events-none absolute right-20 bottom-24 size-3 rounded-full bg-[#e6bb4d] shadow-[0_0_0_10px_rgba(230,187,77,0.12)]" />
      <div className="relative z-10">
        <Brand dark />
      </div>

      <div className="relative z-10 mt-24 max-w-xl xl:mt-28">
        <h1 className="text-sm font-semibold tracking-[0.24em] text-[#e6bb4d] uppercase">
          Portal akademik terpadu
        </h1>
        <div className="mt-10 grid gap-4">
          {highlights.map(({ icon: Icon, label }) => (
            <div className="flex items-center gap-4" key={label}>
              <span className="grid size-11 place-items-center rounded-full border border-white/10 bg-white/10 text-[#f2c85b]">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <span className="text-sm font-medium text-blue-50">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute right-[-8%] bottom-[-5%] opacity-10">
        <GraduationCap className="size-[28rem]" strokeWidth={0.7} />
      </div>
      <div className="relative z-10 mt-auto flex items-end justify-between gap-8 text-xs tracking-[0.2em] text-blue-100/55 uppercase">
        <span>© SIAKAD ITBKM MUNA BARAT</span>
      </div>
    </section>

    <main className="relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-10 sm:px-8 lg:px-12 xl:px-20">
      <div className="pointer-events-none absolute -top-40 -right-40 size-[32rem] rounded-full border border-[#dce8f2]" />
      <div className="pointer-events-none absolute -right-36 -bottom-36 size-72 rounded-full bg-[#e8eff6]/70" />
      <div className="relative z-10 w-full max-w-[36rem]">
        <div className="mb-8 flex justify-center lg:hidden">
          <Brand />
        </div>
        {children}
      </div>
    </main>
  </div>
);

export default PublicAuthLayout;
