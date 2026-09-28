import {
  SidebarInset,
  SidebarProvider,
} from "@siakad-itbkmmubar/ui/components/sidebar";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import Header from "@/components/header";
import Sidebar from "@/components/sidebar";
import { authClient } from "@/lib/auth-client";
import { client } from "@/utils/orpc";

const AuthLayout = () => {
  const { access, session } = Route.useRouteContext();

  return (
    <SidebarProvider>
      <Sidebar roles={access.roles} />
      <SidebarInset>
        <Header userName={session.data?.user.name ?? "Pengguna"} />
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
      throw redirect({ to: "/dashboard" });
    }
    return { access, session };
  },
});
