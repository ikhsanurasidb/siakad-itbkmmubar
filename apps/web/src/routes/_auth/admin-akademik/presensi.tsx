import { createFileRoute } from "@tanstack/react-router";

import AttendancePage from "@/components/attendance-page";

const Page = () => <AttendancePage mode="REVIEWER" roleName="Admin Akademik" />;

export const Route = createFileRoute("/_auth/admin-akademik/presensi")({
  component: Page,
});
