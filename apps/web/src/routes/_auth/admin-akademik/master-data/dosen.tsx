import { createFileRoute } from "@tanstack/react-router";

import MasterDataPage from "@/components/master-data-page";

const Page = () => (
  <MasterDataPage
    description="Kelola data dosen. DSN diterbitkan otomatis saat provisioning akun."
    entityType="LECTURER"
    title="Master Dosen"
  />
);
export const Route = createFileRoute("/_auth/admin-akademik/master-data/dosen")(
  { component: Page }
);
