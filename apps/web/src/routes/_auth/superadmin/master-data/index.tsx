import { createFileRoute } from "@tanstack/react-router";

import MasterDataDashboardPage from "@/components/master-data-dashboard-page";

const Page = () => (
  <MasterDataDashboardPage
    basePath="/superadmin/master-data"
    roleName="Superadmin"
  />
);

export const Route = createFileRoute("/_auth/superadmin/master-data/")({
  component: Page,
});
