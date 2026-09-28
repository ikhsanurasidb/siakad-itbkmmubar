import type { IdentityType } from "@siakad-itbkmmubar/api/identity";
import { Button } from "@siakad-itbkmmubar/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@siakad-itbkmmubar/ui/components/card";
import { ConfirmationDialog } from "@siakad-itbkmmubar/ui/components/confirmation-dialog";
import { DataTable } from "@siakad-itbkmmubar/ui/components/data-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clipboard, KeyRound } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

interface IdentityAccountsPageProps {
  description: string;
  resettableIdentityTypes: readonly IdentityType[];
  title: string;
}

interface ResetTarget {
  accountId: string;
  identifier: string;
  name: string;
}

interface ResetCredential extends ResetTarget {
  temporaryPassword: string;
}

interface AccountTableRow {
  canReset: boolean;
  handleReset: () => void;
  id: string;
  identifier: string;
  identityType: string;
  mustChangePassword: string;
  name: string;
  status: string;
}

const identityTypeLabels: Record<IdentityType, string> = {
  ADMIN_AKADEMIK: "Admin Akademik",
  ADMIN_KEUANGAN: "Admin Keuangan",
  DOSEN: "Dosen",
  MAHASISWA: "Mahasiswa",
  SUPERADMIN: "Superadmin",
};

const accountStatusLabels: Record<string, string> = {
  ACTIVE: "Aktif",
  INACTIVE: "Tidak aktif",
};

const AccountResetAction = ({
  onReset: handleReset,
}: {
  onReset: () => void;
}) => (
  <Button onClick={handleReset} size="sm" type="button" variant="outline">
    <KeyRound aria-hidden="true" />
    Atur ulang kata sandi
  </Button>
);

const renderAccountResetAction = (row: AccountTableRow): ReactNode =>
  row.canReset ? <AccountResetAction onReset={row.handleReset} /> : null;

const copyCredential = async (value: string, label: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} disalin.`);
  } catch {
    toast.error(`${label} belum dapat disalin.`);
  }
};

const IdentityAccountsPage = ({
  description,
  resettableIdentityTypes,
  title,
}: IdentityAccountsPageProps) => {
  const queryClient = useQueryClient();
  const [resetTarget, setResetTarget] = useState<ResetTarget | null>(null);
  const [resetCredential, setResetCredential] =
    useState<ResetCredential | null>(null);
  const resettableTypes = useMemo(
    () => new Set(resettableIdentityTypes),
    [resettableIdentityTypes]
  );
  const accounts = useQuery(
    orpc.identity.accounts.list.queryOptions({
      input: { limit: 50 },
    })
  );
  const resetPassword = useMutation(
    orpc.identity.accounts.resetPassword.mutationOptions({
      onError: () => toast.error("Kata sandi belum dapat diatur ulang."),
      onSuccess: async (result) => {
        if (resetTarget) {
          setResetCredential({
            ...resetTarget,
            temporaryPassword: result.temporaryPassword,
          });
        }
        setResetTarget(null);
        toast.success(
          "Kata sandi diatur ulang. Sampaikan kredensial sementara dengan aman."
        );
        await queryClient.invalidateQueries({
          queryKey: orpc.identity.accounts.list.key(),
        });
      },
    })
  );

  let accountContent: ReactNode;
  if (accounts.isPending) {
    accountContent = (
      <p className="text-muted-foreground text-sm">Memuat akun...</p>
    );
  } else if (accounts.data?.length) {
    const accountRows: AccountTableRow[] = accounts.data.map((row) => ({
      canReset: resettableTypes.has(row.account.identityType as IdentityType),
      handleReset: () => {
        setResetCredential(null);
        setResetTarget({
          accountId: row.account.id,
          identifier: row.account.identifier,
          name: row.name,
        });
      },
      id: row.account.id,
      identifier: row.account.identifier,
      identityType:
        identityTypeLabels[row.account.identityType as IdentityType] ?? "—",
      mustChangePassword: row.account.mustChangePassword
        ? "Wajib ganti"
        : "Selesai",
      name: row.name,
      status: accountStatusLabels[row.account.status] ?? "—",
    }));
    accountContent = (
      <DataTable
        columns={[
          { header: "ID login", id: "identifier" },
          { header: "Nama", id: "name" },
          { header: "Tipe", id: "identityType" },
          { header: "Status", id: "status" },
          { header: "Kata sandi awal", id: "mustChangePassword" },
          {
            cell: renderAccountResetAction,
            header: "Aksi",
            id: "action",
          },
        ]}
        getRowKey={(row) => row.id}
        rows={accountRows}
      />
    );
  } else {
    accountContent = (
      <p className="text-muted-foreground text-sm">
        Belum ada akun untuk ditampilkan.
      </p>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <div className="grid gap-2">
        <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Identitas dan akses
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Daftar akun</CardTitle>
          <CardDescription>
            ID login diterbitkan server dan tidak dapat diubah.
          </CardDescription>
        </CardHeader>
        <CardContent>{accountContent}</CardContent>
      </Card>
      {resetCredential && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-950">
              <KeyRound aria-hidden="true" className="size-5" />
              Kredensial sementara
            </CardTitle>
            <CardDescription className="text-amber-900">
              Kata sandi ini hanya ditampilkan setelah reset dan wajib diganti
              pada login berikutnya. Simpan atau sampaikan melalui kanal aman.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-amber-200 bg-white p-4">
              <p className="text-muted-foreground text-xs font-medium">Akun</p>
              <p className="mt-1 font-semibold">{resetCredential.name}</p>
              <p className="text-muted-foreground text-sm">
                {resetCredential.identifier}
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-white p-4">
              <p className="text-muted-foreground text-xs font-medium">
                Kata sandi sementara
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <code className="font-semibold break-all">
                  {resetCredential.temporaryPassword}
                </code>
                <Button
                  aria-label="Salin kata sandi sementara"
                  onClick={() =>
                    copyCredential(
                      resetCredential.temporaryPassword,
                      "Kata sandi sementara"
                    )
                  }
                  size="icon-sm"
                  type="button"
                  variant="outline"
                >
                  <Clipboard aria-hidden="true" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <ConfirmationDialog
        confirmLabel="Atur ulang kata sandi"
        onCancel={() => setResetTarget(null)}
        onConfirm={() => {
          if (resetTarget) {
            resetPassword.mutate({ accountId: resetTarget.accountId });
          }
        }}
        open={Boolean(resetTarget)}
        title="Atur ulang kata sandi akun?"
      >
        {resetTarget
          ? `Akun ${resetTarget.name} akan keluar dari semua perangkat dan wajib mengganti kata sandi saat masuk berikutnya.`
          : null}
      </ConfirmationDialog>
    </div>
  );
};

export default IdentityAccountsPage;
