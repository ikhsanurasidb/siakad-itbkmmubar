import { createFileRoute } from "@tanstack/react-router";

import SettingsDashboardPage from "@/components/settings-dashboard-page";

const Page = () => <SettingsDashboardPage roleName="Superadmin" />;

export const Route = createFileRoute("/_auth/superadmin/pengaturan/")({
  component: Page,
});
