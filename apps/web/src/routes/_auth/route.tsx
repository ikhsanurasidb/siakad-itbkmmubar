import type { RoleKey } from "@siakad-itbkmmubar/api/identity";
import {
  SidebarInset,
  SidebarProvider,
} from "@siakad-itbkmmubar/ui/components/sidebar";
import { useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  createFileRoute,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { useState } from "react";

import Header from "@/components/header";
import Sidebar from "@/components/sidebar";
import { storeActiveRole } from "@/lib/active-role";
import { authClient } from "@/lib/auth-client";
import { getDashboardRoleSlug } from "@/lib/dashboard";
import { client } from "@/utils/orpc";

const AuthLayout = () => {
  const { access, session } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeRole, setActiveRole] = useState<RoleKey | null>(
    access.activeRole
  );
  const canSwitchRole = access.availableRoles.includes("SUPERADMIN");
  const visibleRoles =
    canSwitchRole && activeRole ? [activeRole] : access.roles;

  const handleActiveRoleChange = async (role: RoleKey): Promise<void> => {
    storeActiveRole(role);
    setActiveRole(role);
    queryClient.removeQueries();
    await navigate({
      params: { role: getDashboardRoleSlug(role) },
      to: "/dashboard/$role",
    });
  };

  return (
    <SidebarProvider>
      <Sidebar roles={visibleRoles} />
      <SidebarInset>
        <Header
          activeRole={activeRole}
          availableRoles={access.availableRoles}
          onActiveRoleChange={handleActiveRoleChange}
          userName={session.data?.user.name ?? "Pengguna"}
        />
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
};

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  beforeLoad: async ({ location }) => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({
        to: "/login",
      });
    }
    const access = await client.identity.status();
    if (access.status !== "ACTIVE") {
      throw redirect({ to: "/login" });
    }
    if (
      access.mustChangePassword &&
      location.pathname !== "/first-login/change-password"
    ) {
      throw redirect({
        to: "/first-login/change-password",
      });
    }
    if (
      !access.mustChangePassword &&
      location.pathname === "/first-login/change-password"
    ) {
      if (!access.activeRole) {
        throw redirect({ to: "/login" });
      }
      throw redirect({
        params: { role: getDashboardRoleSlug(access.activeRole) },
        to: "/dashboard/$role",
      });
    }
    return { access, session };
  },
});
