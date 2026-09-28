import { createFileRoute } from "@tanstack/react-router";

import MasterDataPage from "@/components/master-data-page";

const Page = () => (
  <MasterDataPage
    description="Kelola kode, nama, dan jenjang program studi."
    entityType="STUDY_PROGRAM"
    title="Data program studi"
  />
);
export const Route = createFileRoute("/_auth/admin-akademik/master-data/prodi")(
  { component: Page }
);
