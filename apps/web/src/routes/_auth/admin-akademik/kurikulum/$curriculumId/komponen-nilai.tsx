import { createFileRoute } from "@tanstack/react-router";

import CurriculumAssessmentPage from "@/components/curriculum-assessment-page";

const Page = () => {
  const { curriculumId } = Route.useParams();
  return (
    <CurriculumAssessmentPage
      basePath="/admin-akademik/kurikulum"
      canManage={false}
      curriculumId={curriculumId}
      roleName="Admin Akademik"
    />
  );
};

export const Route = createFileRoute(
  "/_auth/admin-akademik/kurikulum/$curriculumId/komponen-nilai"
)({
  component: Page,
});
