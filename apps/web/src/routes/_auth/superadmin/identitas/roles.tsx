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
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <div className="grid gap-2">
        <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Identitas dan akses
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Role sistem</h1>
        <p className="text-muted-foreground text-sm">
          Katalog role konkret tanpa fallback Staff.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Role yang tersedia</CardTitle>
          <CardDescription>
            Assignment role mengikuti policy dan conflict rules server.
          </CardDescription>
        </CardHeader>
        <CardContent>{roleContent}</CardContent>
      </Card>
    </div>
  );
};

export const Route = createFileRoute("/_auth/superadmin/identitas/roles")({
  component: RolesPage,
});
