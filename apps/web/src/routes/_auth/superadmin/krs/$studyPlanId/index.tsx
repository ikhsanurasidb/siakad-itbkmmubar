import { createFileRoute } from "@tanstack/react-router";

import StudyPlanDetailPage from "@/components/study-plan-detail-page";

const Page = () => {
  const { studyPlanId } = Route.useParams();
  return (
    <StudyPlanDetailPage
      basePath="/superadmin/krs"
      canManage={true}
      studyPlanId={studyPlanId}
    />
  );
};

export const Route = createFileRoute("/_auth/superadmin/krs/$studyPlanId/")({
  component: Page,
});
