import { createFileRoute } from "@tanstack/react-router";

import MasterDataPage from "@/components/master-data-page";

const Page = () => (
  <MasterDataPage
    description="Kelola seluruh ruang dan koordinat validnya."
    entityType="ROOM"
    title="Master Ruang"
  />
);
export const Route = createFileRoute("/_auth/superadmin/master-data/ruang")({
  component: Page,
});
