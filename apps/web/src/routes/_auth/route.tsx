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
  const { session } = Route.useRouteContext();

  return (
    <SidebarProvider>
      <div className="flex min-h-svh w-full flex-col">
        <Header userName={session.data?.user.name ?? "Pengguna"} />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <SidebarInset>
            <Outlet />
          </SidebarInset>
        </div>
      </div>
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
    return { session };
  },
});
