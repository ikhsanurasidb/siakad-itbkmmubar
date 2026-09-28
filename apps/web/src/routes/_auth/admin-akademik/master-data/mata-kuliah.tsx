import { createFileRoute } from "@tanstack/react-router";

import MasterDataPage from "@/components/master-data-page";

const Page = () => (
  <MasterDataPage
    description="Kelola mata kuliah, SKS, semester default, dan Prodi pemilik."
    entityType="COURSE"
    title="Master Mata Kuliah"
  />
);
export const Route = createFileRoute(
  "/_auth/admin-akademik/master-data/mata-kuliah"
)({ component: Page });
