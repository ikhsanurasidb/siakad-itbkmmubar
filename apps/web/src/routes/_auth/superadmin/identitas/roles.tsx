import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import IdentityCatalogPage from "@/components/identity-catalog-page";
import { orpc } from "@/utils/orpc";

const RolesPage = () => {
  const roles = useQuery(orpc.identity.roles.list.queryOptions());

  let roleContent: ReactNode;
  if (roles.isPending) {
    roleContent = (
      <p className="text-muted-foreground text-sm">Memuat role...</p>
    );
  } else if (roles.data?.length) {
    roleContent = (
      <ul className="grid gap-2">
        {roles.data.map((role) => (
          <li className="border-border border p-3" key={role.key}>
            <p className="text-sm font-medium">{role.name}</p>
            <p className="text-muted-foreground text-xs">
              {role.key} · {role.description}
            </p>
          </li>
        ))}
      </ul>
    );
  } else {
    roleContent = (
      <p className="text-muted-foreground text-sm">
        Katalog role belum tersedia.
      </p>
    );
  }

  return (
    <IdentityCatalogPage
      cardDescription="Assignment role mengikuti policy dan conflict rules server."
      cardTitle="Role yang tersedia"
      description="Katalog role konkret tanpa fallback Staff."
      title="Role sistem"
    >
      {roleContent}
    </IdentityCatalogPage>
  );
};

export const Route = createFileRoute("/_auth/superadmin/identitas/roles")({
  component: RolesPage,
});
