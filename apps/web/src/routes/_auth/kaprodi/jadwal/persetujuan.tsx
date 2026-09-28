import { createFileRoute } from "@tanstack/react-router";

import SchedulingPage from "@/components/scheduling-page";

const Page = () => <SchedulingPage mode="APPROVAL" roleName="Kaprodi" />;

export const Route = createFileRoute("/_auth/kaprodi/jadwal/persetujuan")({
  component: Page,
});
