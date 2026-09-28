import { createFileRoute } from "@tanstack/react-router";

import MasterDataPage from "@/components/master-data-page";

const Page = () => (
  <MasterDataPage
    description="Kelola seluruh data dosen dan pantau penerbitan akun DSN."
    entityType="LECTURER"
    title="Data dosen"
  />
);
export const Route = createFileRoute("/_auth/superadmin/master-data/dosen")({
  component: Page,
});
