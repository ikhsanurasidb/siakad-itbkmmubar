import { createFileRoute } from "@tanstack/react-router";

import MasterDataImportPage from "@/components/master-data-import-page";

const Page = () => (
  <MasterDataImportPage
    description="Validasi dan commit data master melalui staging yang dapat dilanjutkan."
    title="Import Master Data"
  />
);
export const Route = createFileRoute(
  "/_auth/admin-akademik/master-data/import"
)({ component: Page });
