import { createFileRoute } from "@tanstack/react-router";

import MasterDataDetailPage from "@/components/master-data-detail-page";
import { masterDataEntityFromSlug } from "@/components/master-data-types";

const Page = () => {
  const { entityType: entitySlug, recordId } = Route.useParams();
  const entityType = masterDataEntityFromSlug(entitySlug);
  if (!entityType) {
    return <p className="p-6 text-sm">Jenis data master tidak ditemukan.</p>;
  }
  return (
    <MasterDataDetailPage
      basePath="/superadmin/master-data"
      entityType={entityType}
      recordId={recordId}
    />
  );
};

export const Route = createFileRoute(
  "/_auth/superadmin/master-data/$entityType/$recordId"
)({ component: Page });
