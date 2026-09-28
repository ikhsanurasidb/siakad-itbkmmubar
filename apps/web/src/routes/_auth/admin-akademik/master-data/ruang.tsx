import { createFileRoute } from "@tanstack/react-router";

import MasterDataPage from "@/components/master-data-page";

const Page = () => (
  <MasterDataPage
    description="Kelola ruang, kapasitas, dan koordinat untuk operasional akademik."
    entityType="ROOM"
    title="Data ruang"
  />
);
export const Route = createFileRoute("/_auth/admin-akademik/master-data/ruang")(
  { component: Page }
);
