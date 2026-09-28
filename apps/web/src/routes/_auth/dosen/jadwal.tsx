import { createFileRoute } from "@tanstack/react-router";

import SchedulingPage from "@/components/scheduling-page";

const Page = () => <SchedulingPage mode="LECTURER" roleName="Dosen" />;

export const Route = createFileRoute("/_auth/dosen/jadwal")({
  component: Page,
});
