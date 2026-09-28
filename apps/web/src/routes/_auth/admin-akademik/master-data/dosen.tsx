import { createFileRoute } from "@tanstack/react-router";

import MasterDataPage from "@/components/master-data-page";

const Page = () => (
  <MasterDataPage
    description="Kelola data dosen dan pantau penerbitan akun DSN."
    entityType="LECTURER"
    title="Data dosen"
  />
);
export const Route = createFileRoute("/_auth/admin-akademik/master-data/dosen")(
  { component: Page }
);
