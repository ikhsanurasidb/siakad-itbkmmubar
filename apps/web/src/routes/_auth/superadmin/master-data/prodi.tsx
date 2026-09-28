import { createFileRoute } from "@tanstack/react-router";

import MasterDataPage from "@/components/master-data-page";

const Page = () => (
  <MasterDataPage
    description="Kelola seluruh program studi, jenjang, dan statusnya."
    entityType="STUDY_PROGRAM"
    title="Data program studi"
  />
);
export const Route = createFileRoute("/_auth/superadmin/master-data/prodi")({
  component: Page,
});
