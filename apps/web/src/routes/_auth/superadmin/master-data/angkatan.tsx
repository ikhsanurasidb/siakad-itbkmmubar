import { createFileRoute } from "@tanstack/react-router";

import MasterDataPage from "@/components/master-data-page";

const Page = () => (
  <MasterDataPage
    description="Kelola seluruh tahun masuk pada setiap program studi."
    entityType="COHORT"
    title="Data angkatan"
  />
);
export const Route = createFileRoute("/_auth/superadmin/master-data/angkatan")({
  component: Page,
});
