import { createFileRoute } from "@tanstack/react-router";

import CurriculumStructurePage from "@/components/curriculum-structure-page";

const Page = () => {
  const { curriculumId } = Route.useParams();
  return (
    <CurriculumStructurePage
      basePath="/kaprodi/kurikulum"
      canManage
      curriculumId={curriculumId}
      roleName="Kaprodi"
    />
  );
};

export const Route = createFileRoute(
  "/_auth/kaprodi/kurikulum/$curriculumId/struktur"
)({
  component: Page,
});
