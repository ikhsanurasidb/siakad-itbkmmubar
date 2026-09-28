import { createFileRoute } from "@tanstack/react-router";

import SchedulingPage from "@/components/scheduling-page";

const Page = () => <SchedulingPage mode="STUDENT" roleName="Mahasiswa" />;

export const Route = createFileRoute("/_auth/mahasiswa/jadwal")({
  component: Page,
});
