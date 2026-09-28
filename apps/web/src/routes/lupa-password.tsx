import { Button } from "@siakad-itbkmmubar/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@siakad-itbkmmubar/ui/components/card";
import { Input } from "@siakad-itbkmmubar/ui/components/input";
import { Label } from "@siakad-itbkmmubar/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { Link, createFileRoute } from "@tanstack/react-router";
import { CircleHelp, LockKeyhole, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import PublicAuthLayout from "@/components/public-auth-layout";

const ForgotPasswordPage = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const recoveryForm = useForm({
    defaultValues: {
      identifier: "",
    },
    onSubmit: () => {
      setIsSubmitted(true);
      toast.success("Permintaan bantuan siap ditindaklanjuti.");
    },
  });

  return (
    <PublicAuthLayout>
      <Card className="border-white/70 bg-white/95 shadow-[0_24px_80px_-32px_rgba(18,57,92,0.38)]">
        <CardHeader className="items-center px-7 pt-9 text-center sm:px-12 sm:pt-12">
          <span className="grid size-16 place-items-center rounded-2xl bg-[#e8eff6] text-[#12395c] shadow-inner">
            <LockKeyhole aria-hidden="true" className="size-8" />
          </span>
          <div className="mt-5 grid gap-2">
            <p className="text-sm font-bold tracking-wide text-[#12395c]">
              PEMULIHAN AKUN
            </p>
            <span className="mx-auto mt-3 h-1.5 w-14 rounded-full bg-[#e6bb4d]" />
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#102f4d] sm:text-4xl">
              Lupa password?
            </h1>
            <p className="mx-auto max-w-sm text-sm leading-6 text-slate-400">
              Masukkan identifier Anda. Admin Akademik akan membantu memulihkan
              akses dengan aman.
            </p>
          </div>
        </CardHeader>
        <CardContent className="px-7 pb-9 sm:px-12 sm:pb-12">
          {isSubmitted ? (
            <div className="mt-5 grid gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
              <div className="flex items-start gap-3">
                <CircleHelp className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                <div className="grid gap-1">
                  <p className="font-semibold">
                    Permintaan Anda sudah disiapkan.
                  </p>
                  <p className="leading-6 text-emerald-800/80">
                    Hubungi Admin Akademik untuk menerima instruksi reset dan
                    password sementara.
                  </p>
                </div>
              </div>
              <Button
                className="h-12 rounded-xl bg-[#12395c] text-white hover:bg-[#0d2d49]"
                onClick={() => setIsSubmitted(false)}
                type="button"
              >
                Kirim identifier lain
              </Button>
            </div>
          ) : (
            <form
              className="mt-5 grid gap-5"
              noValidate
              onSubmit={async (event) => {
                event.preventDefault();
                event.stopPropagation();
                await recoveryForm.handleSubmit();
              }}
            >
              <recoveryForm.Field
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
                        <LockKeyhole
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
              </recoveryForm.Field>
              <recoveryForm.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting]}
              >
                {([canSubmit, isSubmitting]) => (
                  <Button
                    className="h-14 rounded-xl bg-[#e6bb4d] text-base font-bold text-[#102f4d] shadow-lg shadow-[#e6bb4d]/20 hover:bg-[#d8aa35]"
                    disabled={!canSubmit || isSubmitting}
                    type="submit"
                  >
                    {isSubmitting ? "Menyiapkan..." : "Kirim permintaan"}
                  </Button>
                )}
              </recoveryForm.Subscribe>
            </form>
          )}
          <div className="mt-8 flex items-center gap-3 border-t border-slate-200 pt-6 text-xs text-slate-500">
            <ShieldCheck
              aria-hidden="true"
              className="size-5 text-emerald-500"
            />
            <span>Reset password diproses oleh Admin Akademik.</span>
          </div>
          <Link
            className="mt-5 block text-center text-sm font-semibold text-[#12395c] hover:text-[#d09f2b]"
            to="/login"
          >
            Kembali ke halaman masuk
          </Link>
        </CardContent>
      </Card>
    </PublicAuthLayout>
  );
};

export const Route = createFileRoute("/lupa-password")({
  component: ForgotPasswordPage,
});
