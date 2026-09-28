import { createFileRoute } from "@tanstack/react-router";

import CurriculumStructurePage from "@/components/curriculum-structure-page";

const Page = () => {
  const { curriculumId } = Route.useParams();
  return (
    <CurriculumStructurePage
      basePath="/superadmin/kurikulum"
      canManage
      curriculumId={curriculumId}
      roleName="Superadmin"
    />
  );
};

export const Route = createFileRoute(
  "/_auth/superadmin/kurikulum/$curriculumId/struktur"
)({
  component: Page,
});
