import { Button } from "@siakad-itbkmmubar/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@siakad-itbkmmubar/ui/components/card";
import { Input } from "@siakad-itbkmmubar/ui/components/input";
import { Label } from "@siakad-itbkmmubar/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";

import PublicAuthLayout from "@/components/public-auth-layout";
import { authClient } from "@/lib/auth-client";

const RouteComponent = () => {
  const navigate = useNavigate();
  const loginForm = useForm({
    defaultValues: {
      identifier: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      const result = await authClient.signIn
        .username({
          password: value.password,
          username: value.identifier.trim().toUpperCase(),
        })
        .catch(() => null);

      if (!result) {
        toast.error("Sistem tidak dapat memproses login saat ini.");
        return;
      }
      if (result.error) {
        toast.error("Identifier atau kata sandi tidak valid.");
        return;
      }
      await navigate({ to: "/dashboard" }).catch(() => {
        toast.error("Sistem tidak dapat membuka dashboard saat ini.");
      });
    },
  });

  return (
    <PublicAuthLayout>
      <Card className="border-white/70 bg-white/95 shadow-[0_24px_80px_-32px_rgba(18,57,92,0.38)]">
        <CardHeader className="items-center px-7 pt-9 text-center sm:px-12 sm:pt-12">
          <span className="grid size-16 place-items-center rounded-2xl bg-[#e8eff6] text-3xl font-bold text-[#12395c] shadow-inner">
            S
          </span>
          <div className="mt-5 grid gap-2">
            <p className="text-sm font-bold tracking-wide text-[#12395c]">
              SIAKAD ITB KMMU BAR
            </p>
            <span className="mx-auto mt-3 h-1.5 w-14 rounded-full bg-[#e6bb4d]" />
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#102f4d] sm:text-4xl">
              Selamat datang
            </h1>
            <p className="text-base text-slate-500">Masuk ke sistem</p>
            <p className="mx-auto max-w-sm text-sm leading-6 text-slate-400">
              Gunakan identifier resmi dan kata sandi Anda untuk melanjutkan.
            </p>
          </div>
        </CardHeader>
        <CardContent className="px-7 pb-9 sm:px-12 sm:pb-12">
          <form
            className="mt-5 grid gap-5"
            noValidate
            onSubmit={async (event) => {
              event.preventDefault();
              event.stopPropagation();
              await loginForm.handleSubmit();
            }}
          >
            <loginForm.Field
              name="identifier"
              validators={{
                onChange: ({ value }) =>
                  value.trim() ? undefined : "Identifier wajib diisi.",
                onBlur: ({ value }) =>
                  value.trim() ? undefined : "Identifier wajib diisi.",
              }}
            >
              {(field) => {
                const [error] = field.state.meta.errors;
                return (
                  <div className="grid gap-2">
                    <Label
                      className="text-sm font-semibold text-[#173653]"
                      htmlFor={field.name}
                    >
                      Identifier
                    </Label>
                    <div className="relative">
                      <UserRound
                        aria-hidden="true"
                        className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-400"
                      />
                      <Input
                        aria-describedby={
                          error ? `${field.name}-error` : undefined
                        }
                        aria-invalid={Boolean(error)}
                        autoComplete="username"
                        className="h-14 rounded-xl border-slate-200 bg-white pl-12 text-sm shadow-sm placeholder:text-slate-400 focus-visible:border-[#12395c] focus-visible:ring-[#12395c]/20"
                        id={field.name}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        placeholder="Contoh: NIM atau DSN..."
                        value={field.state.value}
                      />
                    </div>
                    {error && (
                      <p
                        className="text-destructive text-xs"
                        id={`${field.name}-error`}
                      >
                        {error}
                      </p>
                    )}
                  </div>
                );
              }}
            </loginForm.Field>
            <loginForm.Field
              name="password"
              validators={{
                onChange: ({ value }) =>
                  value ? undefined : "Kata sandi wajib diisi.",
                onBlur: ({ value }) =>
                  value ? undefined : "Kata sandi wajib diisi.",
              }}
            >
              {(field) => {
                const [error] = field.state.meta.errors;
                return (
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label
                        className="text-sm font-semibold text-[#173653]"
                        htmlFor={field.name}
                      >
                        Kata sandi
                      </Label>
                      <Link
                        className="text-xs font-semibold text-[#12395c] hover:text-[#e0aa2f]"
                        to="/lupa-password"
                      >
                        Lupa password?
                      </Link>
                    </div>
                    <div className="relative">
                      <LockKeyhole
                        aria-hidden="true"
                        className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-400"
                      />
                      <Input
                        aria-describedby={
                          error ? `${field.name}-error` : undefined
                        }
                        aria-invalid={Boolean(error)}
                        autoComplete="current-password"
                        className="h-14 rounded-xl border-slate-200 bg-white pl-12 text-sm shadow-sm placeholder:text-slate-400 focus-visible:border-[#12395c] focus-visible:ring-[#12395c]/20"
                        id={field.name}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        type="password"
                        value={field.state.value}
                      />
                    </div>
                    {error && (
                      <p
                        className="text-destructive text-xs"
                        id={`${field.name}-error`}
                      >
                        {error}
                      </p>
                    )}
                  </div>
                );
              }}
            </loginForm.Field>
            <loginForm.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
            >
              {([canSubmit, isSubmitting]) => (
                <Button
                  className="mt-1 h-14 rounded-xl bg-[#e6bb4d] text-base font-bold text-[#102f4d] shadow-lg shadow-[#e6bb4d]/20 hover:bg-[#d8aa35]"
                  disabled={!canSubmit || isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? "Memeriksa..." : "Masuk"}
                </Button>
              )}
            </loginForm.Subscribe>
          </form>
          <div className="mt-8 flex items-center gap-3 border-t border-slate-200 pt-6 text-xs text-slate-500">
            <ShieldCheck
              aria-hidden="true"
              className="size-5 text-emerald-500"
            />
            <span>Hubungi Admin Akademik jika mengalami kendala.</span>
          </div>
        </CardContent>
      </Card>
    </PublicAuthLayout>
  );
};

export const Route = createFileRoute("/login")({
  component: RouteComponent,
});
