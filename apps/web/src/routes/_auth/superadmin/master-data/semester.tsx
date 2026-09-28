import { createFileRoute } from "@tanstack/react-router";

import MasterDataPage from "@/components/master-data-page";

const Page = () => (
  <MasterDataPage
    description="Kelola tahun akademik, periode, dan statusnya."
    entityType="ACADEMIC_YEAR"
    title="Periode akademik"
  />
);
export const Route = createFileRoute("/_auth/superadmin/master-data/semester")({
  component: Page,
});
