import { createFileRoute } from "@tanstack/react-router";

import CurriculumDetailPage from "@/components/curriculum-detail-page";

const Page = () => {
  const { curriculumId } = Route.useParams();
  return (
    <CurriculumDetailPage
      basePath="/superadmin/kurikulum"
      canManage
      curriculumId={curriculumId}
      roleName="Superadmin"
    />
  );
};

export const Route = createFileRoute(
  "/_auth/superadmin/kurikulum/$curriculumId/"
)({
  component: Page,
});
