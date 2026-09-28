import { createFileRoute } from "@tanstack/react-router";

import SchedulingPage from "@/components/scheduling-page";

const Page = () => (
  <SchedulingPage mode="ADMIN" roleName="Admin Akademik" view="mapping" />
);

export const Route = createFileRoute("/_auth/admin-akademik/kelas/pemetaan")({
  component: Page,
});
