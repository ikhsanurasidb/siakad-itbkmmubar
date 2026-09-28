import { createFileRoute, redirect } from "@tanstack/react-router";

import RoleDashboardPage from "@/components/role-dashboard-page";
import {
  getDashboardRoleSlug,
  getRoleFromDashboardSlug,
} from "@/lib/dashboard";

const RoleDashboardRoute = () => {
  const { session } = Route.useRouteContext();
  const { role } = Route.useParams();
  const dashboardRole = getRoleFromDashboardSlug(role);

  if (!dashboardRole) {
    return null;
  }

  return (
    <RoleDashboardPage
      role={dashboardRole}
      userName={session.data?.user.name ?? "Pengguna"}
    />
  );
};

export const Route = createFileRoute("/_auth/dashboard/$role")({
  beforeLoad: ({ context, params }) => {
    const dashboardRole = getRoleFromDashboardSlug(params.role);
    const { activeRole } = context.access;

    if (
      !dashboardRole ||
      !context.access.availableRoles.includes(dashboardRole)
    ) {
      if (!activeRole) {
        throw redirect({ to: "/login" });
      }

      throw redirect({
        params: { role: getDashboardRoleSlug(activeRole) },
        to: "/dashboard/$role",
      });
    }
  },
  component: RoleDashboardRoute,
});
