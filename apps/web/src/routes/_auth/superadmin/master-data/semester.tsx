import { createFileRoute } from "@tanstack/react-router";

import MasterDataPage from "@/components/master-data-page";

const Page = () => (
  <MasterDataPage
    description="Kelola tahun akademik dan status periodenya."
    entityType="ACADEMIC_YEAR"
    title="Master Semester"
  />
);
export const Route = createFileRoute("/_auth/superadmin/master-data/semester")({
  component: Page,
});
