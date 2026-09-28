import { createFileRoute } from "@tanstack/react-router";

import MasterDataDashboardPage from "@/components/master-data-dashboard-page";

const Page = () => (
  <MasterDataDashboardPage
    basePath="/admin-akademik/master-data"
    roleName="Admin Akademik"
  />
);

export const Route = createFileRoute("/_auth/admin-akademik/master-data/")({
  component: Page,
});
