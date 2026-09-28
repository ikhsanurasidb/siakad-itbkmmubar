import { createFileRoute } from "@tanstack/react-router";

import StudyPlanListPage from "@/components/study-plan-list-page";

const Page = () => (
  <StudyPlanListPage
    basePath="/kaprodi/krs"
    canGenerate={false}
    roleName="Kaprodi"
  />
);

export const Route = createFileRoute("/_auth/kaprodi/krs/")({
  component: Page,
});
