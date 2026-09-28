import { createFileRoute } from "@tanstack/react-router";

import MasterDataPage from "@/components/master-data-page";

const Page = () => (
  <MasterDataPage
    description="Kelola seluruh ruang, kapasitas, dan koordinatnya."
    entityType="ROOM"
    title="Data ruang"
  />
);
export const Route = createFileRoute("/_auth/superadmin/master-data/ruang")({
  component: Page,
});
