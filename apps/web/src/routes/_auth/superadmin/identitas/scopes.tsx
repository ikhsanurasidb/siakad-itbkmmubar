import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@siakad-itbkmmubar/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { orpc } from "@/utils/orpc";

const ScopesPage = () => {
  const scopes = useQuery(orpc.identity.scopes.list.queryOptions());

  let scopeContent: ReactNode;
  if (scopes.isPending) {
    scopeContent = (
      <p className="text-muted-foreground text-sm">Memuat scope...</p>
    );
  } else if (scopes.data?.length) {
    scopeContent = (
      <ul className="grid gap-2">
        {scopes.data.map((scope) => (
          <li className="border-border border p-3" key={scope.id}>
            <p className="text-sm font-medium">
              {scope.scopeType} · {scope.scopeId}
            </p>
            <p className="text-muted-foreground text-xs">User {scope.userId}</p>
          </li>
        ))}
      </ul>
    );
  } else {
    scopeContent = (
      <p className="text-muted-foreground text-sm">Belum ada scope aktif.</p>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <div className="grid gap-2">
        <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Identitas dan akses
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Scope akses</h1>
        <p className="text-muted-foreground text-sm">
          Tinjau assignment scope Prodi, kelas, dan ownership.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Assignment scope</CardTitle>
          <CardDescription>
            Scope lintas Prodi ditolak pada API sebelum transaksi berjalan.
          </CardDescription>
        </CardHeader>
        <CardContent>{scopeContent}</CardContent>
      </Card>
    </div>
  );
};

export const Route = createFileRoute("/_auth/superadmin/identitas/scopes")({
  component: ScopesPage,
});
