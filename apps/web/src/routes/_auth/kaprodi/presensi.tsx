import { createFileRoute } from "@tanstack/react-router";

import AttendancePage from "@/components/attendance-page";

const Page = () => <AttendancePage mode="REVIEWER" roleName="Kaprodi" />;

export const Route = createFileRoute("/_auth/kaprodi/presensi")({
  component: Page,
});
