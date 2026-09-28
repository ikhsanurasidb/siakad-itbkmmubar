import { createFileRoute } from "@tanstack/react-router";

import MasterDataImportPage from "@/components/master-data-import-page";

const Page = () => (
  <MasterDataImportPage
    description="Validasi, preview, dan commit import master data pada seluruh sistem."
    title="Import Master Data"
  />
);
export const Route = createFileRoute("/_auth/superadmin/master-data/import")({
  component: Page,
});
