import { createFileRoute } from "@tanstack/react-router";

import AttendancePage from "@/components/attendance-page";

const Page = () => <AttendancePage mode="PARTICIPANT" roleName="Dosen" />;

export const Route = createFileRoute("/_auth/dosen/presensi")({
  component: Page,
});
