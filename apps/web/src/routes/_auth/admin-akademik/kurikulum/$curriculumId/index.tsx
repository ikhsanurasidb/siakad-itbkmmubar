import { createFileRoute } from "@tanstack/react-router";

import CurriculumDetailPage from "@/components/curriculum-detail-page";

const Page = () => {
  const { curriculumId } = Route.useParams();
  return (
    <CurriculumDetailPage
      basePath="/admin-akademik/kurikulum"
      canManage={false}
      curriculumId={curriculumId}
      roleName="Admin Akademik"
    />
  );
};

export const Route = createFileRoute(
  "/_auth/admin-akademik/kurikulum/$curriculumId/"
)({
  component: Page,
});
