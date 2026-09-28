import { createFileRoute } from "@tanstack/react-router";

import SchedulingPage from "@/components/scheduling-page";

const Page = () => <SchedulingPage mode="ADMIN" roleName="Superadmin" />;

export const Route = createFileRoute("/_auth/superadmin/kelas/")({
  component: Page,
});
