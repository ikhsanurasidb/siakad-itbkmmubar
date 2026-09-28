import { createFileRoute } from "@tanstack/react-router";

import MasterDataPage from "@/components/master-data-page";

const Page = () => (
  <MasterDataPage
    description="Kelola seluruh angkatan per program studi."
    entityType="COHORT"
    title="Master Angkatan"
  />
);
export const Route = createFileRoute("/_auth/superadmin/master-data/angkatan")({
  component: Page,
});
