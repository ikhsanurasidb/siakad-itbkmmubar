import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@siakad-itbkmmubar/ui/components/card";
import { DataTable } from "@siakad-itbkmmubar/ui/components/data-table";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { orpc } from "@/utils/orpc";

interface IdentityAccountsPageProps {
  description: string;
  title: string;
}

const IdentityAccountsPage = ({
  description,
  title,
}: IdentityAccountsPageProps) => {
  const accounts = useQuery(
    orpc.identity.accounts.list.queryOptions({
      input: { limit: 50 },
    })
  );

  let accountContent: ReactNode;
  if (accounts.isPending) {
    accountContent = (
      <p className="text-muted-foreground text-sm">Memuat akun...</p>
    );
  } else if (accounts.data?.length) {
    accountContent = (
      <DataTable
        columns={[
          { header: "Identifier", id: "identifier" },
          { header: "Nama", id: "name" },
          { header: "Tipe", id: "identityType" },
          { header: "Status", id: "status" },
          { header: "First login", id: "mustChangePassword" },
        ]}
        getRowKey={(row) => row.id}
        rows={accounts.data.map((row) => ({
          id: row.account.id,
          identifier: row.account.identifier,
          identityType: row.account.identityType,
          mustChangePassword: row.account.mustChangePassword
            ? "Wajib ganti"
            : "Selesai",
          name: row.name,
          status: row.account.status,
        }))}
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
            Identifier diterbitkan server dan tidak dapat diubah.
          </CardDescription>
        </CardHeader>
        <CardContent>{accountContent}</CardContent>
      </Card>
    </div>
  );
};

export default IdentityAccountsPage;
