import { createFileRoute } from "@tanstack/react-router";

import MasterDataImportPage from "@/components/master-data-import-page";

const Page = () => (
  <MasterDataImportPage
    description="Unggah, validasi, dan simpan data master secara bertahap."
    title="Impor data master"
  />
);
export const Route = createFileRoute(
  "/_auth/admin-akademik/master-data/import"
)({ component: Page });
