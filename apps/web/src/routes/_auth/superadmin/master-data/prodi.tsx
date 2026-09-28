import { createFileRoute } from "@tanstack/react-router";

import MasterDataPage from "@/components/master-data-page";

const Page = () => (
  <MasterDataPage
    description="Kelola seluruh program studi dan statusnya."
    entityType="STUDY_PROGRAM"
    title="Master Prodi"
  />
);
export const Route = createFileRoute("/_auth/superadmin/master-data/prodi")({
  component: Page,
});
