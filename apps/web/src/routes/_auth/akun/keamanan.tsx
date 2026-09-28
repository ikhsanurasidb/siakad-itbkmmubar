import { Button } from "@siakad-itbkmmubar/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@siakad-itbkmmubar/ui/components/card";
import { FormField } from "@siakad-itbkmmubar/ui/components/form-field";
import { Input } from "@siakad-itbkmmubar/ui/components/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MonitorSmartphone, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { client, orpc, queryClient } from "@/utils/orpc";

interface ContactProfile {
  email: string;
  emailVerified: boolean;
  pendingEmail: string | null;
  phone: string | null;
}

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

const formatDate = (date: Date) => dateFormatter.format(new Date(date));

const revokeOtherSessions = async () => {
  await client.identity.sessions.revokeOthers();
  await queryClient.invalidateQueries({
    queryKey: orpc.identity.sessions.list.queryKey(),
  });
  toast.success("Sesi perangkat lain dicabut.");
};

const EmailChangeForm = ({ profile }: { profile: ContactProfile }) => {
  const navigate = useNavigate();
  const localQueryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const requestEmailChange = useMutation(
    orpc.identity.profile.requestEmailChange.mutationOptions({
      onError: () =>
        toast.error(
          "Permintaan perubahan email belum dapat dibuat. Periksa data dan kata sandi saat ini."
        ),
      onSuccess: async () => {
        setNewEmail("");
        setEmailPassword("");
        setHasSubmitted(false);
        toast.success("Permintaan perubahan email menunggu verifikasi.");
        await localQueryClient.invalidateQueries({
          queryKey: orpc.identity.profile.get.key(),
        });
      },
    })
  );
  const confirmEmailChange = useMutation(
    orpc.identity.profile.confirmEmailChange.mutationOptions({
      onError: () =>
        toast.error("Token verifikasi email belum dapat diproses."),
      onSuccess: async () => {
        toast.success(
          "Email berhasil diubah. Masuk kembali dengan email baru."
        );
        await authClient.signOut();
        await navigate({ to: "/login" });
      },
    })
  );

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setHasSubmitted(true);
    if (!newEmail.trim() || !emailPassword) {
      return;
    }
    requestEmailChange.mutate({
      currentPassword: emailPassword,
      newEmail: newEmail.trim().toLowerCase(),
    });
  };

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div>
        <h2 className="font-semibold">Email akun</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Email login saat ini: {profile.email} ·{" "}
          {profile.emailVerified ? "terverifikasi" : "belum terverifikasi"}
        </p>
      </div>
      <FormField
        error={
          hasSubmitted && !newEmail.trim()
            ? "Email baru wajib diisi."
            : undefined
        }
        id="account-new-email"
        label="Email baru"
      >
        <Input
          aria-invalid={hasSubmitted && !newEmail.trim()}
          autoComplete="email"
          id="account-new-email"
          onChange={(event) => setNewEmail(event.target.value)}
          placeholder="nama@kampus.ac.id"
          type="email"
          value={newEmail}
        />
      </FormField>
      <FormField
        error={
          hasSubmitted && !emailPassword
            ? "Kata sandi saat ini wajib diisi."
            : undefined
        }
        helper="Perubahan email memerlukan kata sandi saat ini dan verifikasi email baru."
        id="account-email-password"
        label="Kata sandi saat ini"
      >
        <Input
          aria-invalid={hasSubmitted && !emailPassword}
          autoComplete="current-password"
          id="account-email-password"
          onChange={(event) => setEmailPassword(event.target.value)}
          type="password"
          value={emailPassword}
        />
      </FormField>
      <Button disabled={requestEmailChange.isPending} type="submit">
        {requestEmailChange.isPending
          ? "Mengirim permintaan..."
          : "Ajukan perubahan email"}
      </Button>
      {profile.pendingEmail && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-950">
            Menunggu verifikasi: {profile.pendingEmail}
          </p>
          <p className="mt-1 text-amber-900">
            Email login belum berubah. Masukkan token dari kanal email untuk
            menerapkan perubahan.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
            <Input
              aria-label="Token verifikasi email"
              onChange={(event) => setVerificationToken(event.target.value)}
              placeholder="Token verifikasi"
              value={verificationToken}
            />
            <Button
              disabled={
                confirmEmailChange.isPending || !verificationToken.trim()
              }
              onClick={() =>
                confirmEmailChange.mutate({
                  verificationToken: verificationToken.trim(),
                })
              }
              type="button"
              variant="outline"
            >
              Verifikasi
            </Button>
          </div>
          <p className="mt-2 text-xs text-amber-900">
            Pengiriman email belum tersedia di lingkungan ini; state pending
            tetap dipertahankan agar email login tidak terganti diam-diam.
          </p>
        </div>
      )}
    </form>
  );
};

const PhoneChangeForm = ({ profile }: { profile: ContactProfile }) => {
  const localQueryClient = useQueryClient();
  const [phoneDraft, setPhoneDraft] = useState("");
  const [phonePassword, setPhonePassword] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const updatePhone = useMutation(
    orpc.identity.profile.updatePhone.mutationOptions({
      onError: () =>
        toast.error(
          "Nomor telepon belum dapat diubah. Periksa format dan kata sandi saat ini."
        ),
      onSuccess: async () => {
        setPhoneDraft("");
        setPhonePassword("");
        setHasSubmitted(false);
        toast.success("Nomor telepon diperbarui.");
        await localQueryClient.invalidateQueries({
          queryKey: orpc.identity.profile.get.key(),
        });
      },
    })
  );

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setHasSubmitted(true);
    if (!phoneDraft.trim() || !phonePassword) {
      return;
    }
    updatePhone.mutate({
      currentPassword: phonePassword,
      phone: phoneDraft.trim(),
    });
  };

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div>
        <h2 className="font-semibold">Nomor telepon</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Nomor saat ini: {profile.phone ?? "Belum diatur"}
        </p>
      </div>
      <FormField
        error={
          hasSubmitted && !phoneDraft.trim()
            ? "Nomor telepon wajib diisi."
            : undefined
        }
        helper="Gunakan 9–15 digit. Spasi, tanda kurung, dan tanda hubung akan dinormalisasi."
        id="account-phone"
        label="Nomor telepon baru"
      >
        <Input
          aria-invalid={hasSubmitted && !phoneDraft.trim()}
          autoComplete="tel"
          id="account-phone"
          onChange={(event) => setPhoneDraft(event.target.value)}
          placeholder="081234567890"
          type="tel"
          value={phoneDraft}
        />
      </FormField>
      <FormField
        error={
          hasSubmitted && !phonePassword
            ? "Kata sandi saat ini wajib diisi."
            : undefined
        }
        id="account-phone-password"
        label="Kata sandi saat ini"
      >
        <Input
          aria-invalid={hasSubmitted && !phonePassword}
          autoComplete="current-password"
          id="account-phone-password"
          onChange={(event) => setPhonePassword(event.target.value)}
          type="password"
          value={phonePassword}
        />
      </FormField>
      <Button disabled={updatePhone.isPending} type="submit">
        {updatePhone.isPending ? "Menyimpan..." : "Simpan nomor telepon"}
      </Button>
    </form>
  );
};

const AccountContactSettings = () => {
  const profile = useQuery(orpc.identity.profile.get.queryOptions());

  let content: ReactNode = (
    <p className="text-muted-foreground text-sm">Memuat data kontak...</p>
  );
  if (profile.isError) {
    content = (
      <p className="text-destructive text-sm" role="alert">
        Data kontak belum dapat dimuat. Coba lagi.
      </p>
    );
  } else if (profile.data) {
    content = (
      <div className="grid gap-6 lg:grid-cols-2">
        <EmailChangeForm profile={profile.data} />
        <PhoneChangeForm profile={profile.data} />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kontak akun</CardTitle>
        <CardDescription>
          Email dan nomor telepon akun disimpan terpisah dari profil master
          data.
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
};

const SecurityComponent = () => {
  const sessions = useQuery(orpc.identity.sessions.list.queryOptions());

  let sessionContent: ReactNode;
  if (sessions.isPending) {
    sessionContent = (
      <p className="text-muted-foreground text-sm">Memuat sesi...</p>
    );
  } else if (sessions.data?.length) {
    sessionContent = (
      <ul className="grid gap-3">
        {sessions.data.map((item) => (
          <li
            className="border-border flex items-start gap-3 border p-3"
            key={item.id}
          >
            {item.isCurrent ? (
              <ShieldCheck
                aria-hidden="true"
                className="text-primary mt-0.5 size-5"
              />
            ) : (
              <MonitorSmartphone
                aria-hidden="true"
                className="text-muted-foreground mt-0.5 size-5"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {item.isCurrent ? "Perangkat ini" : "Perangkat lain"}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {item.userAgent ?? "Perangkat tidak terdeteksi"}
              </p>
              <p className="text-muted-foreground text-xs">
                Aktivitas terakhir {formatDate(item.lastActivityAt)} · IP{" "}
                {item.ipAddress}
              </p>
            </div>
          </li>
        ))}
      </ul>
    );
  } else {
    sessionContent = (
      <p className="text-muted-foreground text-sm">
        Belum ada sesi yang dapat ditampilkan.
      </p>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <div className="grid gap-2">
        <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Keamanan akun
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Perangkat aktif
        </h1>
        <p className="text-muted-foreground text-sm">
          Tinjau dan cabut sesi yang tidak lagi Anda kenali.
        </p>
      </div>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Sesi aktif</CardTitle>
            <CardDescription>
              Sesi tidak aktif selama 72 jam akan berakhir otomatis.
            </CardDescription>
          </div>
          <Button onClick={revokeOtherSessions} variant="outline">
            Cabut perangkat lain
          </Button>
        </CardHeader>
        <CardContent>{sessionContent}</CardContent>
      </Card>
      <AccountContactSettings />
    </div>
  );
};

export const Route = createFileRoute("/_auth/akun/keamanan")({
  component: SecurityComponent,
});
