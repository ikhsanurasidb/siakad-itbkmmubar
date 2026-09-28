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
import { PageHeader } from "@siakad-itbkmmubar/ui/components/page-header";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clipboard, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

interface CreatedAdmin {
  identifier: string;
  temporaryPassword: string;
}

const copyCredential = async (value: string, label: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} disalin.`);
  } catch {
    toast.error(`${label} belum dapat disalin.`);
  }
};

const AdminCreatePage = () => {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [createdAdmin, setCreatedAdmin] = useState<CreatedAdmin | null>(null);
  const createAdmin = useMutation(
    orpc.identity.admins.create.mutationOptions({
      onError: () => {
        toast.error(
          "Admin belum dapat dibuat. Periksa data atau gunakan email lain."
        );
      },
      onSuccess: async (result) => {
        setCreatedAdmin(result);
        setName("");
        setEmail("");
        setHasSubmitted(false);
        toast.success("Admin Akademik berhasil ditambahkan.");
        await queryClient.invalidateQueries({
          queryKey: orpc.identity.accounts.list.key(),
        });
      },
    })
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setHasSubmitted(true);
    setCreatedAdmin(null);
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedName) {
      return;
    }
    createAdmin.mutate({
      ...(normalizedEmail ? { email: normalizedEmail } : {}),
      name: normalizedName,
    });
  };

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <PageHeader
        description="Buat akun administrator secara manual. Fitur ini hanya tersedia saat peran aktif Anda adalah Superadmin."
        eyebrow="Identitas dan akses · Superadmin"
        title="Tambah admin"
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Data admin baru</CardTitle>
            <CardDescription>
              Identifier dan kata sandi sementara dibuat otomatis oleh sistem.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-5" onSubmit={handleSubmit}>
              <FormField
                error={
                  hasSubmitted && !name.trim() ? "Nama wajib diisi." : undefined
                }
                id="admin-name"
                label="Nama lengkap"
              >
                <Input
                  aria-invalid={hasSubmitted && !name.trim()}
                  autoComplete="name"
                  id="admin-name"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Nama admin akademik"
                  value={name}
                />
              </FormField>
              <FormField
                helper="Jika dikosongkan, sistem memakai email internal akun. Login tetap menggunakan identifier."
                id="admin-email"
                label="Email"
                optional
              >
                <Input
                  autoComplete="email"
                  id="admin-email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nama@kampus.ac.id"
                  type="email"
                  value={email}
                />
              </FormField>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={createAdmin.isPending}
                  size="lg"
                  type="submit"
                >
                  {createAdmin.isPending
                    ? "Membuat akun..."
                    : "Tambah Admin Akademik"}
                </Button>
                <p className="text-muted-foreground text-xs">
                  Admin Keuangan akan tersedia pada tahap berikutnya.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck aria-hidden="true" className="size-5" />
              Peran akun
            </CardTitle>
            <CardDescription>
              Peran dikunci oleh server untuk alur penambahan ini.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-[#dbe5ee] bg-[#f8fafc] p-4">
              <p className="font-semibold text-[#102d4d]">Admin Akademik</p>
              <p className="mt-1 text-xs text-[#71859c]">
                Mengelola layanan akademik sesuai kewenangan yang tersedia.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {createdAdmin && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-900">
              <CheckCircle2 aria-hidden="true" className="size-5" />
              Akun berhasil dibuat
            </CardTitle>
            <CardDescription className="text-emerald-800">
              Salin kredensial sekarang. Kata sandi sementara hanya ditampilkan
              pada hasil pembuatan ini dan wajib diganti saat login pertama.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-emerald-200 bg-white p-4">
              <p className="text-muted-foreground text-xs font-medium">
                Identifier
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <code className="font-semibold text-emerald-950">
                  {createdAdmin.identifier}
                </code>
                <Button
                  aria-label="Salin identifier"
                  onClick={() =>
                    copyCredential(createdAdmin.identifier, "Identifier")
                  }
                  size="icon-sm"
                  variant="outline"
                >
                  <Clipboard aria-hidden="true" />
                </Button>
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-white p-4">
              <p className="text-muted-foreground text-xs font-medium">
                Kata sandi sementara
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <code className="font-semibold break-all text-emerald-950">
                  {createdAdmin.temporaryPassword}
                </code>
                <Button
                  aria-label="Salin kata sandi sementara"
                  onClick={() =>
                    copyCredential(
                      createdAdmin.temporaryPassword,
                      "Kata sandi sementara"
                    )
                  }
                  size="icon-sm"
                  variant="outline"
                >
                  <Clipboard aria-hidden="true" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminCreatePage;
