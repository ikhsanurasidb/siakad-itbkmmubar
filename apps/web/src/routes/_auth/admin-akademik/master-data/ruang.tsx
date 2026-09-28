import { createFileRoute } from "@tanstack/react-router";

import MasterDataPage from "@/components/master-data-page";

const Page = () => (
  <MasterDataPage
    description="Kelola kapasitas dan koordinat ruang untuk operasional akademik."
    entityType="ROOM"
    title="Master Ruang"
  />
);
export const Route = createFileRoute("/_auth/admin-akademik/master-data/ruang")(
  { component: Page }
);
