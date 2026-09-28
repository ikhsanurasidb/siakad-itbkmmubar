import { createFileRoute } from "@tanstack/react-router";

import StudyPlanDetailPage from "@/components/study-plan-detail-page";

const Page = () => {
  const { studyPlanId } = Route.useParams();
  return (
    <StudyPlanDetailPage
      basePath="/kaprodi/krs"
      canManage={false}
      studyPlanId={studyPlanId}
    />
  );
};

export const Route = createFileRoute("/_auth/kaprodi/krs/$studyPlanId/")({
  component: Page,
});
