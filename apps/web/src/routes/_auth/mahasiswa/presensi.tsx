import { createFileRoute } from "@tanstack/react-router";

import AttendancePage from "@/components/attendance-page";

const Page = () => <AttendancePage mode="PARTICIPANT" roleName="Mahasiswa" />;

export const Route = createFileRoute("/_auth/mahasiswa/presensi")({
  component: Page,
});
