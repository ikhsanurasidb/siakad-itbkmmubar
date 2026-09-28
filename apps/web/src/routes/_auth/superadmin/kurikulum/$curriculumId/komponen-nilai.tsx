import { createFileRoute } from "@tanstack/react-router";

import CurriculumAssessmentPage from "@/components/curriculum-assessment-page";

const Page = () => {
  const { curriculumId } = Route.useParams();
  return (
    <CurriculumAssessmentPage
      basePath="/superadmin/kurikulum"
      canManage
      curriculumId={curriculumId}
      roleName="Superadmin"
    />
  );
};

export const Route = createFileRoute(
  "/_auth/superadmin/kurikulum/$curriculumId/komponen-nilai"
)({
  component: Page,
});
