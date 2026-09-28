import { createFileRoute } from "@tanstack/react-router";

import MasterDataPage from "@/components/master-data-page";

const Page = () => (
  <MasterDataPage
    description="Kelola identitas akademik mahasiswa dan status provisioning."
    entityType="STUDENT"
    title="Master Mahasiswa"
  />
);
export const Route = createFileRoute(
  "/_auth/admin-akademik/master-data/mahasiswa"
)({ component: Page });
