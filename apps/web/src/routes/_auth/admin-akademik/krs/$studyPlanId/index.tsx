import { createFileRoute } from "@tanstack/react-router";

import StudyPlanDetailPage from "@/components/study-plan-detail-page";

const Page = () => {
  const { studyPlanId } = Route.useParams();
  return (
    <StudyPlanDetailPage
      basePath="/admin-akademik/krs"
      canManage
      studyPlanId={studyPlanId}
    />
  );
};

export const Route = createFileRoute("/_auth/admin-akademik/krs/$studyPlanId/")(
  { component: Page }
);
