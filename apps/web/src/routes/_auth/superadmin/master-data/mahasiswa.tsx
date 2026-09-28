import { createFileRoute } from "@tanstack/react-router";

import MasterDataPage from "@/components/master-data-page";

const Page = () => (
  <MasterDataPage
    description="Kelola seluruh data mahasiswa pada lingkup sistem."
    entityType="STUDENT"
    title="Master Mahasiswa"
  />
);
export const Route = createFileRoute("/_auth/superadmin/master-data/mahasiswa")(
  { component: Page }
);
