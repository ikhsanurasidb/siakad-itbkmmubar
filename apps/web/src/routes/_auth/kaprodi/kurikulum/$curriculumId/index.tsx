import { createFileRoute } from "@tanstack/react-router";

import CurriculumDetailPage from "@/components/curriculum-detail-page";

const Page = () => {
  const { curriculumId } = Route.useParams();
  return (
    <CurriculumDetailPage
      basePath="/kaprodi/kurikulum"
      canManage
      curriculumId={curriculumId}
      roleName="Kaprodi"
    />
  );
};

export const Route = createFileRoute("/_auth/kaprodi/kurikulum/$curriculumId/")(
  {
    component: Page,
  }
);
