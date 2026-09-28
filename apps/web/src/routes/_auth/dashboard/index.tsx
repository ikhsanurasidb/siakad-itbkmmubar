import { createFileRoute, redirect } from "@tanstack/react-router";

import { getDashboardRoleSlug } from "@/lib/dashboard";

export const Route = createFileRoute("/_auth/dashboard/")({
  beforeLoad: ({ context }) => {
    const { activeRole } = context.access;
    if (!activeRole) {
      throw redirect({ to: "/login" });
    }

    throw redirect({
      params: { role: getDashboardRoleSlug(activeRole) },
      to: "/dashboard/$role",
    });
  },
});
