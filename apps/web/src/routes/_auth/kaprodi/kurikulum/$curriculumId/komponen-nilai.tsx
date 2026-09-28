import { createFileRoute } from "@tanstack/react-router";

import CurriculumAssessmentPage from "@/components/curriculum-assessment-page";

const Page = () => {
  const { curriculumId } = Route.useParams();
  return (
    <CurriculumAssessmentPage
      basePath="/kaprodi/kurikulum"
      canManage
      curriculumId={curriculumId}
      roleName="Kaprodi"
    />
  );
};

export const Route = createFileRoute(
  "/_auth/kaprodi/kurikulum/$curriculumId/komponen-nilai"
)({
  component: Page,
});
