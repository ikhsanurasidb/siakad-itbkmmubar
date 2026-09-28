import { createFileRoute, redirect } from "@tanstack/react-router";

import AdminCreatePage from "@/components/admin-create-page";

export const Route = createFileRoute("/_auth/superadmin/identitas/admin")({
  beforeLoad: ({ context }) => {
    if (!context.access.roles.includes("SUPERADMIN")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AdminCreatePage,
});
