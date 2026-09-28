import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import IdentityCatalogPage from "@/components/identity-catalog-page";
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
    <IdentityCatalogPage
      cardDescription="Scope lintas Prodi ditolak pada API sebelum transaksi berjalan."
      cardTitle="Assignment scope"
      description="Tinjau assignment scope Prodi, kelas, dan ownership."
      title="Scope akses"
    >
      {scopeContent}
    </IdentityCatalogPage>
  );
};

export const Route = createFileRoute("/_auth/superadmin/identitas/scopes")({
  component: ScopesPage,
});
