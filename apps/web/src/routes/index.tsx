import { createFileRoute, redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";
import { getDashboardRoleSlug } from "@/lib/dashboard";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({ to: "/login" });
    }

    const access = await client.identity.status().catch(() => null);
    if (!access || access.status !== "ACTIVE") {
      throw redirect({ to: "/login" });
    }
    if (access.mustChangePassword) {
      throw redirect({ to: "/first-login/change-password" });
    }
    if (!access.activeRole) {
      throw redirect({ to: "/login" });
    }

    throw redirect({
      params: { role: getDashboardRoleSlug(access.activeRole) },
      to: "/dashboard/$role",
    });
  },
});
