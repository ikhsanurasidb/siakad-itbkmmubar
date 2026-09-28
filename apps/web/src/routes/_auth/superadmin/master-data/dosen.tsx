import { createFileRoute } from "@tanstack/react-router";

import MasterDataPage from "@/components/master-data-page";

const Page = () => (
  <MasterDataPage
    description="Kelola seluruh data dosen. DSN diterbitkan otomatis oleh provisioning."
    entityType="LECTURER"
    title="Master Dosen"
  />
);
export const Route = createFileRoute("/_auth/superadmin/master-data/dosen")({
  component: Page,
});
