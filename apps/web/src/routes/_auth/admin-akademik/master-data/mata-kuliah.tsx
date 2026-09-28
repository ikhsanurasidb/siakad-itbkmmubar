import { createFileRoute } from "@tanstack/react-router";

import MasterDataPage from "@/components/master-data-page";

const Page = () => (
  <MasterDataPage
    description="Kelola mata kuliah, SKS, semester, dan Prodi pemilik."
    entityType="COURSE"
    title="Data mata kuliah"
  />
);
export const Route = createFileRoute(
  "/_auth/admin-akademik/master-data/mata-kuliah"
)({ component: Page });
