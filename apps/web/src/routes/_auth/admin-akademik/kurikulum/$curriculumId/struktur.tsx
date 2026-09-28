import { createFileRoute } from "@tanstack/react-router";

import CurriculumStructurePage from "@/components/curriculum-structure-page";

const Page = () => {
  const { curriculumId } = Route.useParams();
  return (
    <CurriculumStructurePage
      basePath="/admin-akademik/kurikulum"
      canManage={false}
      curriculumId={curriculumId}
      roleName="Admin Akademik"
    />
  );
};

export const Route = createFileRoute(
  "/_auth/admin-akademik/kurikulum/$curriculumId/struktur"
)({
  component: Page,
});
