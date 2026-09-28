import { createFileRoute } from "@tanstack/react-router";

import MasterDataPage from "@/components/master-data-page";

const Page = () => (
  <MasterDataPage
    description="Kelola seluruh identitas akademik mahasiswa dan penerbitan akun."
    entityType="STUDENT"
    title="Data mahasiswa"
  />
);
export const Route = createFileRoute("/_auth/superadmin/master-data/mahasiswa")(
  { component: Page }
);
