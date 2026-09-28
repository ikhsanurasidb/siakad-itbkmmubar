import { Button } from "@siakad-itbkmmubar/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@siakad-itbkmmubar/ui/components/card";
import { Input } from "@siakad-itbkmmubar/ui/components/input";
import { Label } from "@siakad-itbkmmubar/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LockKeyhole } from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { client } from "@/utils/orpc";

const MINIMUM_PASSWORD_LENGTH = 16;

const ChangePasswordComponent = () => {
  const navigate = useNavigate();
  const changePasswordForm = useForm({
    defaultValues: {
      confirmation: "",
      currentPassword: "",
      newPassword: "",
    },
    onSubmit: async ({ value }) => {
      const result = await authClient.changePassword({
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) {
        toast.error("Kata sandi sementara tidak valid atau sudah kedaluwarsa.");
        return;
      }

      const completion = await client.identity.firstLogin.complete();
      if (!completion) {
        toast.error(
          "Kata sandi berubah, tetapi status akses belum diperbarui."
        );
        return;
      }
      toast.success("Kata sandi berhasil diperbarui.");
      await navigate({ to: "/dashboard" });
    },
  });

  return (
    <div className="mx-auto grid min-h-[calc(100svh-4.5rem)] w-full max-w-xl place-items-center p-4 sm:p-8">
      <Card className="w-full border-white/70 bg-white/95 shadow-[0_24px_80px_-32px_rgba(18,57,92,0.35)]">
        <CardHeader className="gap-4 p-7 sm:p-10">
          <span className="grid size-12 place-items-center rounded-2xl bg-[#e8eff6] text-[#12395c]">
            <LockKeyhole aria-hidden="true" className="size-6" />
          </span>
          <div className="grid gap-2">
            <CardTitle className="text-2xl text-[#102f4d]">
              Ganti kata sandi sementara
            </CardTitle>
            <CardDescription className="text-sm leading-6">
              Perbarui kata sandi sebelum menggunakan layanan akademik lain.
              Gunakan minimal 16 karakter.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-7 pb-8 sm:px-10 sm:pb-10">
          <form
            className="grid gap-5"
            noValidate
            onSubmit={async (event) => {
              event.preventDefault();
              event.stopPropagation();
              await changePasswordForm.handleSubmit();
            }}
          >
            <changePasswordForm.Field
              name="currentPassword"
              validators={{
                onBlur: ({ value }) =>
                  value ? undefined : "Kata sandi sementara wajib diisi.",
              }}
            >
              {(field) => (
                <div className="grid gap-2">
                  <Label className="text-sm font-semibold" htmlFor={field.name}>
                    Kata sandi sementara
                  </Label>
                  <Input
                    autoComplete="current-password"
                    id={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    type="password"
                    value={field.state.value}
                  />
                  {field.state.meta.errors[0] && (
                    <p className="text-destructive text-xs">
                      {field.state.meta.errors[0]}
                    </p>
                  )}
                </div>
              )}
            </changePasswordForm.Field>
            <changePasswordForm.Field
              name="newPassword"
              validators={{
                onBlur: ({ value }) =>
                  value.length < MINIMUM_PASSWORD_LENGTH
                    ? `Minimal ${MINIMUM_PASSWORD_LENGTH} karakter.`
                    : undefined,
              }}
            >
              {(field) => (
                <div className="grid gap-2">
                  <Label className="text-sm font-semibold" htmlFor={field.name}>
                    Kata sandi baru
                  </Label>
                  <Input
                    autoComplete="new-password"
                    id={field.name}
                    minLength={MINIMUM_PASSWORD_LENGTH}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    type="password"
                    value={field.state.value}
                  />
                  {field.state.meta.errors[0] && (
                    <p className="text-destructive text-xs">
                      {field.state.meta.errors[0]}
                    </p>
                  )}
                </div>
              )}
            </changePasswordForm.Field>
            <changePasswordForm.Field
              name="confirmation"
              validators={{
                onBlur: ({ value }) => {
                  if (
                    value === changePasswordForm.getFieldValue("newPassword")
                  ) {
                    return;
                  }
                  return "Konfirmasi kata sandi belum sesuai.";
                },
              }}
            >
              {(field) => (
                <div className="grid gap-2">
                  <Label className="text-sm font-semibold" htmlFor={field.name}>
                    Konfirmasi kata sandi baru
                  </Label>
                  <Input
                    autoComplete="new-password"
                    id={field.name}
                    minLength={MINIMUM_PASSWORD_LENGTH}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    type="password"
                    value={field.state.value}
                  />
                  {field.state.meta.errors[0] && (
                    <p className="text-destructive text-xs">
                      {field.state.meta.errors[0]}
                    </p>
                  )}
                </div>
              )}
            </changePasswordForm.Field>
            <changePasswordForm.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
            >
              {([canSubmit, isSubmitting]) => (
                <Button
                  className="mt-1 h-12 rounded-xl bg-[#12395c] text-white hover:bg-[#0d2d49]"
                  disabled={!canSubmit || isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan kata sandi"}
                </Button>
              )}
            </changePasswordForm.Subscribe>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export const Route = createFileRoute("/_auth/first-login/change-password")({
  component: ChangePasswordComponent,
});
