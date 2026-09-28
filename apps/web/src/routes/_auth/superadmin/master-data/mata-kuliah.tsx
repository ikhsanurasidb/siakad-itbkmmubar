import { createFileRoute } from "@tanstack/react-router";

import MasterDataPage from "@/components/master-data-page";

const Page = () => (
  <MasterDataPage
    description="Kelola seluruh mata kuliah, semester, dan Prodi pemiliknya."
    entityType="COURSE"
    title="Data mata kuliah"
  />
);
export const Route = createFileRoute(
  "/_auth/superadmin/master-data/mata-kuliah"
)({ component: Page });
