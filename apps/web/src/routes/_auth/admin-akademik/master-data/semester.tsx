import { createFileRoute } from "@tanstack/react-router";

import MasterDataPage from "@/components/master-data-page";

const Page = () => (
  <MasterDataPage
    description="Kelola tahun akademik, periode, dan tanggal berlakunya."
    entityType="ACADEMIC_PERIOD"
    title="Periode akademik"
  />
);
export const Route = createFileRoute(
  "/_auth/admin-akademik/master-data/semester"
)({ component: Page });
