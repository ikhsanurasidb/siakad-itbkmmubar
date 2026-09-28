import { createFileRoute } from "@tanstack/react-router";

import StudyPlanDetailPage from "@/components/study-plan-detail-page";

const Page = () => {
  const { studyPlanId } = Route.useParams();
  return (
    <StudyPlanDetailPage
      basePath="/mahasiswa/krs"
      canManage={false}
      studyPlanId={studyPlanId}
    />
  );
};

export const Route = createFileRoute("/_auth/mahasiswa/krs/$studyPlanId/")({
  component: Page,
});
